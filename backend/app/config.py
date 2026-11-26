import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./chat.db")
    # Keep relative SQLite files next to the backend, wherever the server is started from.
    if url.startswith("sqlite:///./"):
        url = f"sqlite:///{(BACKEND_DIR / url.removeprefix('sqlite:///./')).as_posix()}"
    return url


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    llm_base_url: str = field(default_factory=lambda: os.getenv("LLM_BASE_URL", "").strip())
    llm_api_key: str = field(default_factory=lambda: os.getenv("LLM_API_KEY", "").strip())
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "llama-3.3-70b-versatile"))
    llm_temperature: float = field(default_factory=lambda: _float("LLM_TEMPERATURE", 0.8))
    assistant_name: str = field(default_factory=lambda: os.getenv("ASSISTANT_NAME", "Nova"))
    database_url: str = field(default_factory=_database_url)
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()
        )
    )
    rate_limit_per_minute: int = field(default_factory=lambda: _int("RATE_LIMIT_PER_MINUTE", 20))
    max_history_messages: int = field(default_factory=lambda: _int("MAX_HISTORY_MESSAGES", 20))

    @property
    def demo_mode(self) -> bool:
        # No key and no local server configured: answer with a canned reply
        # so the UI can still be tried out end to end.
        is_local = "localhost" in self.llm_base_url or "127.0.0.1" in self.llm_base_url
        return not self.llm_api_key and not is_local


@lru_cache
def get_settings() -> Settings:
    return Settings()
