import pytest

from backend.config import Settings, get_settings


@pytest.fixture(autouse=True)
def settings_without_dotenv(monkeypatch: pytest.MonkeyPatch):
    """Make every test see the same settings as CI, which has no .env file.

    Without this, a test can pass on a laptop only because .env sets a value and then fail in CI.
    Tests that need other settings build `Settings(...)` themselves.
    """
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    for name in ("DATABASE_URL", "AI_SERVICE_URL", "CORS_ORIGINS"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("INTERNAL_API_KEY", "test-key")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
