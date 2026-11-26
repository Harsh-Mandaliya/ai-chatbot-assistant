import re

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .db import get_db
from .models import Conversation

_CLIENT_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def client_id(x_client_id: str = Header(default="")) -> str:
    """The browser sends a random id it keeps in localStorage."""
    if not _CLIENT_ID.match(x_client_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing or invalid X-Client-Id header.")
    return x_client_id


def owned_conversation(
    conversation_id: str,
    owner: str = Depends(client_id),
    db: Session = Depends(get_db),
) -> Conversation:
    convo = db.get(Conversation, conversation_id)
    if convo is None or convo.client_id != owner:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That conversation doesn't exist.")
    return convo
