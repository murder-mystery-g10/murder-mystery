from typing import Literal

from shared_schemas.base import Schema


class HealthResponse(Schema):
    """Response of every service's GET /health endpoint."""

    status: Literal["ok"] = "ok"
    service: str
    version: str


class ReadinessResponse(Schema):
    """Response of the backend's GET /api/health/ready; HTTP 503 when a dependency is down."""

    database: bool
    ai_service: bool
