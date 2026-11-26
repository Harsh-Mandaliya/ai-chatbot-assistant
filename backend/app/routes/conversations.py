from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import client_id, owned_conversation
from ..models import Conversation
from ..schemas import ConversationCreate, ConversationDetail, ConversationOut, ConversationUpdate

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    engine: Literal["online", "offline"] = Query(default="online"),
    owner: str = Depends(client_id),
    db: Session = Depends(get_db),
):
    """Chats for one mode only: Online and Offline histories are kept apart."""
    query = (
        select(Conversation)
        .where(Conversation.client_id == owner, Conversation.engine == engine)
        .order_by(Conversation.updated_at.desc())
        .limit(200)
    )
    return db.scalars(query).all()


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    body: ConversationCreate | None = None,
    owner: str = Depends(client_id),
    db: Session = Depends(get_db),
):
    convo = Conversation(
        client_id=owner,
        title=(body.title if body and body.title else "New chat"),
        engine=body.engine if body else "online",
    )
    db.add(convo)
    db.commit()
    return convo


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(convo: Conversation = Depends(owned_conversation)):
    return convo


@router.patch("/{conversation_id}", response_model=ConversationOut)
def rename_conversation(
    body: ConversationUpdate,
    convo: Conversation = Depends(owned_conversation),
    db: Session = Depends(get_db),
):
    convo.title = body.title
    db.commit()
    return convo


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(convo: Conversation = Depends(owned_conversation), db: Session = Depends(get_db)):
    db.delete(convo)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
