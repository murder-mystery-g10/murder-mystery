from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Environment variables win. Otherwise .env is read from the current folder, or from its
    # parent when a command runs inside a service folder (e.g. alembic in backend/).
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "postgresql+asyncpg://murder:murder@localhost:5432/murder"
    ai_service_url: str = "http://localhost:8001"
    # Shared secret sent to the AI service in the X-Internal-Key header.
    internal_api_key: str
    # Origins allowed to call the API and open a socket (the frontend).
    cors_origins: list[str] = ["http://localhost:5173"]
    # Folder with the case library (*.json). Default: cases/ at the repository root.
    cases_dir: Path = Path(__file__).resolve().parents[3] / "cases"


@lru_cache
def get_settings() -> Settings:
    return Settings()
