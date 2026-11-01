from importlib.metadata import version

from fastapi import Depends, FastAPI

from ai_service.routes import router
from ai_service.security import require_internal_key
from shared_schemas import HealthResponse

SERVICE_NAME = "ai-service"
SERVICE_VERSION = version(SERVICE_NAME)


def create_app() -> FastAPI:
    app = FastAPI(title="Murder Mystery — AI Service", version=SERVICE_VERSION)

    @app.get("/health", response_model=HealthResponse, tags=["meta"])
    def health() -> HealthResponse:
        return HealthResponse(service=SERVICE_NAME, version=SERVICE_VERSION)

    app.include_router(router, dependencies=[Depends(require_internal_key)])
    return app


app = create_app()
