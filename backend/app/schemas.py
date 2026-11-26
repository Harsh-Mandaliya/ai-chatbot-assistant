from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_MESSAGE_LENGTH = 4000

# SQLite hands datetimes back without a timezone. They are stored in UTC,
# so say so explicitly before they go out to the browser.
UtcDatetime = Annotated[datetime, AfterValidator(lambda d: d if d.tzinfo else d.replace(tzinfo=timezone.utc))]


MAX_IMAGES_PER_MESSAGE = 6
# Base64 makes files about a third bigger; this is a rough upper bound before decoding.
MAX_DATA_URL_LENGTH = 16 * 1024 * 1024


class MessageIn(BaseModel):
    content: str = Field(default="", max_length=MAX_MESSAGE_LENGTH)
    # Screenshots or photos as data URLs (data:image/png;base64,...).
    images: list[Annotated[str, Field(max_length=MAX_DATA_URL_LENGTH)]] = Field(
        default_factory=list, max_length=MAX_IMAGES_PER_MESSAGE
    )
    # Set when the previous reply failed and the same question is asked again.
    retry: bool = False
    engine: Literal["online", "offline"] = "online"
    subject: str = Field(default="general", pattern=r"^[a-z]{2,20}$")
    level: Literal["beginner", "advanced", "deep"] = "beginner"
    mode: Literal["chat", "quiz"] = "chat"

    @field_validator("content")
    @classmethod
    def tidy(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def has_something(self) -> "MessageIn":
        if not self.content and not self.images:
            raise ValueError("Message can't be empty")
        return self


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: Literal["user", "assistant"]
    content: str
    engine: Literal["online", "offline"] = "online"
    images: list[str] = []
    created_at: UtcDatetime


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    engine: Literal["online", "offline"] = "online"


class ConversationUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def tidy(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Title can't be empty")
        return value


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    engine: Literal["online", "offline"] = "online"
    created_at: UtcDatetime
    updated_at: UtcDatetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class SubjectOut(BaseModel):
    id: str
    name: str
    starters: list[str]


class Definition(BaseModel):
    title: str
    summary: str
    url: str | None = None
