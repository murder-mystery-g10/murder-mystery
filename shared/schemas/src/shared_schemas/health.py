from typing import Literal

from shared_schemas.base import Schema


class HealthResponse(Schema):
    """Response of every service's GET /health endpoint."""

    status: Literal["ok"] = "ok"
    service: str
    version: str
