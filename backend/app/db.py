from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

_url = get_settings().database_url
_connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}

engine = create_engine(_url, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (registers the tables)

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """Tiny migration for databases created before images and offline mode existed."""
    from sqlalchemy import inspect, text

    added = {
        "messages": {
            "engine": "ALTER TABLE messages ADD COLUMN engine VARCHAR(10) DEFAULT 'online'",
            "images_json": "ALTER TABLE messages ADD COLUMN images_json TEXT",
        },
        "conversations": {
            "engine": "ALTER TABLE conversations ADD COLUMN engine VARCHAR(10) DEFAULT 'online'",
        },
    }
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in added.items():
            existing = {c["name"] for c in inspector.get_columns(table)}
            for column, ddl in columns.items():
                if column not in existing:
                    conn.execute(text(ddl))
