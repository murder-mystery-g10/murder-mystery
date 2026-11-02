from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Environment variables win. Otherwise .env is read from the current folder, or from its
    # parent when a command runs inside a service folder (e.g. alembic in backend/).
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    # Shared secret the backend sends in the X-Internal-Key header.
    internal_api_key: str


@lru_cache
def get_settings() -> Settings:
    return Settings()
