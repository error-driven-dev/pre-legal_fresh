from sqlalchemy import inspect, select

from app.db import SessionLocal, engine, reset_database
from app.features.users.models import User


def test_users_table_created_on_startup(client: object) -> None:
    columns = {c["name"] for c in inspect(engine).get_columns("users")}
    assert columns == {"id", "email", "password_hash", "created_at"}


def test_reset_database_starts_from_scratch(client: object) -> None:
    with SessionLocal() as session:
        session.add(User(email="a@example.com", password_hash="x"))
        session.commit()
    reset_database()
    with SessionLocal() as session:
        assert session.scalars(select(User)).all() == []
