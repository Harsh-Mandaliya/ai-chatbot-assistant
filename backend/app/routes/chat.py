import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import SessionLocal, get_db
from ..deps import owned_conversation
from ..llm import LLMError, stream_reply
from ..models import Conversation, Message
from ..rate_limit import RateLimiter, client_key
from ..schemas import MessageIn, MessageOut

router = APIRouter(prefix="/api/conversations", tags=["chat"])

limiter = RateLimiter(limit=get_settings().rate_limit_per_minute)


def _title_from(text: str) -> str:
    title = " ".join(text.split())
    return title if len(title) <= 48 else title[:45].rstrip() + "..."


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


def _history(db: Session, conversation_id: str, limit: int) -> list[dict[str, str]]:
    rows = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    ).all()
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


@router.post("/{conversation_id}/messages")
async def send_message(
    body: MessageIn,
    request: Request,
    convo: Conversation = Depends(owned_conversation),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    limiter.check(client_key(request))

    last = convo.messages[-1] if convo.messages else None
    if body.retry and last is not None and last.role == "user" and last.content == body.content:
        # The question is already saved, only the answer is missing.
        user_msg = last
    else:
        user_msg = Message(conversation_id=convo.id, role="user", content=body.content)
        db.add(user_msg)
        if last is None and convo.title == "New chat":
            convo.title = _title_from(body.content)
        db.commit()

    history = _history(db, convo.id, settings.max_history_messages)
    conversation_id, title = convo.id, convo.title
    user_out = MessageOut.model_validate(user_msg).model_dump(mode="json")

    async def events() -> AsyncIterator[str]:
        yield _sse({"type": "start", "userMessage": user_out, "title": title})
        parts: list[str] = []
        failed = False
        try:
            async for chunk in stream_reply(history, settings):
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
                    msg = Message(conversation_id=conversation_id, role="assistant", content=reply)
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
