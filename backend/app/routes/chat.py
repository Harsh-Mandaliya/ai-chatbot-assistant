import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import SessionLocal, get_db
from ..deps import owned_conversation
from ..images import as_data_url, save_images
from ..llm import LLMError, stream_reply
from ..models import Conversation, Message
from ..rate_limit import RateLimiter, client_key
from ..schemas import MessageIn, MessageOut

router = APIRouter(prefix="/api/conversations", tags=["chat"])

limiter = RateLimiter(limit=get_settings().rate_limit_per_minute)

# Only the newest few pictures are sent back to the model with each question,
# so long chats with lots of screenshots stay quick.
IMAGES_IN_CONTEXT = 3


def _title_from(text: str, has_images: bool) -> str:
    title = " ".join(text.split())
    if not title:
        return "Screenshot question" if has_images else "New chat"
    return title if len(title) <= 48 else title[:45].rstrip() + "..."


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


def online_images_used_today(db: Session, client_id: str) -> int:
    midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = db.scalars(
        select(Message.images_json)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.client_id == client_id,
            Message.role == "user",
            Message.engine == "online",
            Message.images_json.is_not(None),
            Message.created_at >= midnight,
        )
    ).all()
    return sum(len(json.loads(r)) for r in rows if r)


def _history(db: Session, conversation_id: str, limit: int, settings: Settings) -> list[dict[str, Any]]:
    rows = list(
        reversed(
            db.scalars(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at.desc())
                .limit(limit)
            ).all()
        )
    )
    # Pick the newest images, walking backwards through the chat.
    keep: set[tuple[str, str]] = set()
    for m in reversed(rows):
        for name in reversed(m.image_files):
            if len(keep) < IMAGES_IN_CONTEXT:
                keep.add((m.id, name))

    history = []
    for m in rows:
        pictures = [url for name in m.image_files if (m.id, name) in keep and (url := as_data_url(name, settings))]
        if m.role == "user" and pictures:
            parts: list[dict[str, Any]] = [{"type": "text", "text": m.content or "What's in this image? Help me understand it."}]
            parts += [{"type": "image_url", "image_url": {"url": url}} for url in pictures]
            history.append({"role": "user", "content": parts})
        elif m.image_files and not m.content:
            history.append({"role": m.role, "content": "(shared an image)"})
        else:
            history.append({"role": m.role, "content": m.content})
    return history


@router.post("/{conversation_id}/messages")
async def send_message(
    body: MessageIn,
    request: Request,
    convo: Conversation = Depends(owned_conversation),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    if body.engine != convo.engine:
        other = "Offline" if convo.engine == "offline" else "Online"
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This chat belongs to {other} mode. Switch to {other}, or start a new chat here.",
        )
    online = body.engine == "online"

    # Online runs on a shared free quota, so it gets limits. Offline runs on
    # your own computer, so it gets none.
    if online:
        limiter.check(client_key(request))
        if body.level == "deep":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Deep dive is an Offline mode feature. Switch to Offline to use it."
            )

    last = convo.messages[-1] if convo.messages else None
    reuse = body.retry and last is not None and last.role == "user" and last.content == body.content

    if online and body.images and not reuse:
        used = online_images_used_today(db, convo.client_id)
        left = settings.online_images_per_day - used
        if len(body.images) > left:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Online mode allows {settings.online_images_per_day} images a day and you have {max(left, 0)} left. "
                "Switch to Offline mode for unlimited uploads.",
            )

    if reuse and last is not None:
        # The question is already saved, only the answer is missing.
        user_msg = last
    else:
        names = save_images(body.images, settings) if body.images else []
        user_msg = Message(
            conversation_id=convo.id,
            role="user",
            content=body.content,
            engine=body.engine,
            images_json=json.dumps(names) if names else None,
        )
        db.add(user_msg)
        if last is None and convo.title == "New chat":
            convo.title = _title_from(body.content, bool(names))
        db.commit()

    limit = settings.max_history_messages if online else settings.offline_max_history_messages
    history = _history(db, convo.id, limit, settings)
    conversation_id, title = convo.id, convo.title
    user_out = MessageOut.model_validate(user_msg).model_dump(mode="json")

    async def events() -> AsyncIterator[str]:
        yield _sse({"type": "start", "userMessage": user_out, "title": title})
        parts: list[str] = []
        failed = False
        try:
            async for chunk in stream_reply(
                history,
                settings,
                engine=body.engine,
                subject=body.subject,
                level=body.level,
                mode=body.mode,
            ):
                parts.append(chunk)
                yield _sse({"type": "token", "content": chunk})
        except LLMError as exc:
            failed = True
            yield _sse({"type": "error", "message": str(exc)})
        finally:
            # Save whatever we got, even if the user hit "stop" halfway through.
            reply = "".join(parts).strip()
            saved = None
            if reply:
                with SessionLocal() as session:
                    msg = Message(conversation_id=conversation_id, role="assistant", content=reply, engine=body.engine)
                    session.add(msg)
                    parent = session.get(Conversation, conversation_id)
                    if parent is not None:
                        parent.updated_at = datetime.now(timezone.utc)
                    session.commit()
                    saved = MessageOut.model_validate(msg).model_dump(mode="json")
        if not failed:
            yield _sse({"type": "done", "message": saved})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
