from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel

from backend.db import is_database_reachable
from backend.meta import SERVICE_NAME, SERVICE_VERSION
from shared_schemas import HealthResponse

router = APIRouter(prefix="/api")


class ReadinessResponse(BaseModel):
    database: bool
    ai_service: bool


@router.get("/health", response_model=HealthResponse, tags=["meta"])
def health() -> HealthResponse:
    """Liveness: the process is up."""
    return HealthResponse(service=SERVICE_NAME, version=SERVICE_VERSION)


@router.get("/health/ready", response_model=ReadinessResponse, tags=["meta"])
async def ready(request: Request, response: Response) -> ReadinessResponse:
    """Readiness: the database and the AI service both answer."""
    result = ReadinessResponse(
        database=await is_database_reachable(request.app.state.engine),
        ai_service=await request.app.state.ai_client.is_healthy(),
    )
    if not (result.database and result.ai_service):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result
