"""Database engine, session dependency and the from-scratch reset used at startup."""

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """Base class for all ORM models. Import each model module in `init_models`."""


def make_engine(database_path: str) -> Engine:
    return create_engine(f"sqlite:///{database_path}", connect_args={"check_same_thread": False})


engine = make_engine(str(settings.database_path))
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def init_models() -> None:
    """Import every model module so its tables register on `Base.metadata`."""
    from app.features.users import models  # noqa: F401


def reset_database() -> None:
    """Drop the SQLite file and create all tables from scratch."""
    engine.dispose()
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    settings.database_path.unlink(missing_ok=True)
    init_models()
    Base.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
