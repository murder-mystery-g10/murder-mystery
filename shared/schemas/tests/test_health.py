import pytest
from pydantic import ValidationError

from shared_schemas import HealthResponse


def test_health_defaults_to_ok() -> None:
    health = HealthResponse(service="backend", version="0.1.0")
    assert health.status == "ok"


def test_unknown_fields_are_rejected() -> None:
    with pytest.raises(ValidationError):
        HealthResponse(service="backend", version="0.1.0", uptime=5)
