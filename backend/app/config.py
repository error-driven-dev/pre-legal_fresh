"""Runtime settings, overridable with environment variables (PRELEGAL_*)."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PRELEGAL_",
        env_file=BACKEND_DIR.parent / ".env",  # local runs; Docker passes env vars instead
        extra="ignore",
        populate_by_name=True,
    )

    # SQLite file, deleted and recreated every time the app starts.
    database_path: Path = BACKEND_DIR / "data" / "prelegal.db"
    # Statically built frontend served at "/" when this directory exists. Defaults to the local
    # `npm run build` output; the Docker image overrides it (see Dockerfile).
    static_dir: Path = BACKEND_DIR.parent / "frontend" / "out"

    # Document templates and the catalog describing them (repo root; copied into the image).
    templates_dir: Path = BACKEND_DIR.parent / "templates"
    catalog_path: Path = BACKEND_DIR.parent / "catalog.json"

    # OpenRouter. The key is read from the unprefixed OPENROUTER_API_KEY (.env) and never
    # leaves the server. Default is a free open-weights model that followed the structured output
    # schema reliably in testing. `openrouter/free` (random free model) was less consistent.
    # Override with PRELEGAL_MODEL.
    openrouter_api_key: str = Field(default="", validation_alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    model: str = "nvidia/nemotron-3-super-120b-a12b:free"


settings = Settings()
