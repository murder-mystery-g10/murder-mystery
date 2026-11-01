import pytest
from fastapi.testclient import TestClient

from backend.config import Settings
from backend.main import create_app
from backend.sockets import create_socket_server

# Points at ports where nothing listens, so readiness must fail fast.
UNREACHABLE = Settings(
    internal_api_key="test",
    database_url="postgresql+asyncpg://x:x@127.0.0.1:1/x",
    ai_service_url="http://127.0.0.1:1",
)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def test_health_is_up() -> None:
    with TestClient(create_app(UNREACHABLE)) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["service"] == "backend"


def test_ready_reports_unreachable_dependencies() -> None:
    with TestClient(create_app(UNREACHABLE)) as client:
        response = client.get("/api/health/ready")
    assert response.status_code == 503
    assert response.json() == {"database": False, "ai_service": False}


@pytest.mark.anyio
async def test_ping_answers_pong() -> None:
    sio = create_socket_server(cors_origins=[])
    handler = sio.handlers["/"]["system:ping"]
    assert await handler("some-sid", None) == {"message": "pong"}
