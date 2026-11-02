from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://murder:murder@localhost:5432/murder"
    ai_service_url: str = "http://localhost:8001"
    # Shared secret sent to the AI service in the X-Internal-Key header.
    internal_api_key: str
    # Origins allowed to call the API and open a socket (the frontend).
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
