import pytest

from ai_service.config import Settings, get_settings
from ai_service.providers import get_provider


@pytest.fixture(autouse=True)
def settings_without_dotenv(monkeypatch: pytest.MonkeyPatch):
    """Make every test see the same settings as CI, which has no .env file.

    Without this, a test can pass on a laptop only because .env sets a value (for example
    INTERNAL_API_KEY) and then fail in CI. Tests that need other settings override
    `get_settings` or build `Settings(...)` themselves.
    """
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    for name in ("AI_PROVIDER", "AI_BASE_URL", "AI_MODEL", "AI_API_KEY", "AI_REASONING_EFFORT"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("INTERNAL_API_KEY", "test-key")
    get_settings.cache_clear()
    get_provider.cache_clear()
    yield
    get_settings.cache_clear()
    get_provider.cache_clear()
