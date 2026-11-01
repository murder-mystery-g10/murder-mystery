import pytest
from fastapi.testclient import TestClient

from ai_service.config import Settings, get_settings
from ai_service.main import app

TEST_KEY = "test-key"


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = lambda: Settings(internal_api_key=TEST_KEY)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "ai-service"


def test_missing_key_is_rejected(client: TestClient) -> None:
    assert client.post("/interrogate").status_code == 401


def test_wrong_key_is_rejected(client: TestClient) -> None:
    response = client.post("/interrogate", headers={"X-Internal-Key": "wrong"})
    assert response.status_code == 401


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/interrogate"),
        ("post", "/generate"),
        ("get", "/generate/some-job"),
        ("post", "/validate"),
    ],
)
def test_stub_endpoints_return_501(client: TestClient, method: str, path: str) -> None:
    response = client.request(method, path, headers={"X-Internal-Key": TEST_KEY})
    assert response.status_code == 501
