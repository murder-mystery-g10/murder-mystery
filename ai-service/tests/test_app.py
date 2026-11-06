import pytest
from fastapi.testclient import TestClient

from ai_service.config import Settings, get_settings
from ai_service.main import app
from ai_service.providers import FakeProvider, get_provider

TEST_KEY = "test-key"
AUTH = {"X-Internal-Key": TEST_KEY}


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = lambda: Settings(internal_api_key=TEST_KEY)
    # /interrogate needs a provider; without this override the real one reads INTERNAL_API_KEY
    # from the environment, which is set in a developer's .env but not in CI.
    app.dependency_overrides[get_provider] = lambda: FakeProvider()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "ai-service"


def test_missing_key_is_rejected(client: TestClient) -> None:
    assert client.post("/interrogate", json={}).status_code == 401


def test_wrong_key_is_rejected(client: TestClient) -> None:
    response = client.post("/interrogate", json={}, headers={"X-Internal-Key": "wrong"})
    assert response.status_code == 401


@pytest.mark.parametrize("path", ["/interrogate", "/generate", "/validate"])
def test_invalid_body_is_rejected(client: TestClient, path: str) -> None:
    assert client.post(path, json={}, headers=AUTH).status_code == 422


def test_valid_generate_request_reaches_the_stub(client: TestClient) -> None:
    body = {"theme": "conac", "player_count": 4, "suspect_count": 4, "difficulty": "normal"}
    assert client.post("/generate", json=body, headers=AUTH).status_code == 501


def test_generation_status_is_a_stub(client: TestClient) -> None:
    assert client.get("/generate/some-job", headers=AUTH).status_code == 501


def test_openapi_exposes_the_contract_models(client: TestClient) -> None:
    schemas = client.get("/openapi.json").json()["components"]["schemas"]
    for name in ("InterrogateRequest", "InterrogateResponse", "GenerationJob", "ValidationReport"):
        assert name in schemas


def test_tests_ignore_dotenv(tmp_path, monkeypatch) -> None:
    # Guards the autouse fixture in conftest.py: a .env file must not change test settings.
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env").write_text("AI_MODEL=from-dotenv\n", encoding="utf-8")
    assert Settings().ai_model == "gemma3:4b"
