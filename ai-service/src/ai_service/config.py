from functools import lru_cache
from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Environment variables win. Otherwise .env is read from the current folder, or from its
    # parent when a command runs inside a service folder (e.g. alembic in backend/).
    # Empty values count as unset, so `AI_API_KEY=` in .env means "no key".
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"), extra="ignore", env_ignore_empty=True
    )

    # Shared secret the backend sends in the X-Internal-Key header.
    internal_api_key: str

    # Model provider (see providers.py and .env.example). Ollama runs locally, for free.
    ai_provider: Literal["azure", "openai", "ollama"] = "ollama"
    ai_base_url: str = "http://localhost:11434/v1"
    ai_model: str = "gemma3:4b"
    ai_api_key: str | None = None
    # Only for reasoning models such as gpt-5-mini; "minimal" answers fastest.
    ai_reasoning_effort: Literal["minimal", "low", "medium", "high"] | None = None
    # Below the backend's 30 s, so the backend gets a clear 503 instead of its own timeout.
    ai_timeout_seconds: float = 20.0

    @model_validator(mode="after")
    def _check_api_key(self) -> Self:
        if self.ai_provider != "ollama" and not self.ai_api_key:
            raise ValueError(f"AI_API_KEY is required when AI_PROVIDER is {self.ai_provider}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
