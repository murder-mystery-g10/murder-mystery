import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from ai_service.meta import SERVICE_NAME, SERVICE_VERSION
from ai_service.providers import ProviderError, get_provider
from ai_service.routes import router
from ai_service.security import require_internal_key
from shared_schemas import HealthResponse

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    if get_provider.cache_info().currsize:
        await get_provider().aclose()


def create_app() -> FastAPI:
    app = FastAPI(title="Murder Mystery — AI Service", version=SERVICE_VERSION, lifespan=lifespan)

    @app.get("/health", response_model=HealthResponse, tags=["meta"])
    def health() -> HealthResponse:
        return HealthResponse(service=SERVICE_NAME, version=SERVICE_VERSION)

    @app.exception_handler(ProviderError)
    async def provider_unavailable(request: Request, error: ProviderError) -> JSONResponse:
        # The backend turns any error into "the suspect refuses to talk".
        logger.warning("AI provider error on %s: %s", request.url.path, error)
        detail = f"AI provider unavailable: {error}"
        return JSONResponse(status_code=503, content={"detail": detail})

    app.include_router(router, dependencies=[Depends(require_internal_key)])
    return app


app = create_app()
