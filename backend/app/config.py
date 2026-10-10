"""Runtime settings, overridable with environment variables (PRELEGAL_*)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PRELEGAL_")

    # SQLite file, deleted and recreated every time the app starts.
    database_path: Path = BACKEND_DIR / "data" / "prelegal.db"
    # Statically built frontend served at "/" when this directory exists. Defaults to the local
    # `npm run build` output; the Docker image overrides it (see Dockerfile).
    static_dir: Path = BACKEND_DIR.parent / "frontend" / "out"


settings = Settings()
