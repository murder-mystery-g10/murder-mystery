from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service configuration, read from environment variables (or a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Shared secret the backend sends in the X-Internal-Key header.
    internal_api_key: str


@lru_cache
def get_settings() -> Settings:
    return Settings()
