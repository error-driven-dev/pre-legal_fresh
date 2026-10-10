"""FastAPI application: JSON API under /api, statically built frontend at /."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import reset_database
from app.features.health.router import router as health_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    reset_database()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.include_router(health_router)
    # Mounted last so /api routes win over the catch-all static files.
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")
    return app


app = create_app()
