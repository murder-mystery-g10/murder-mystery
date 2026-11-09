import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.ai_client import AIClient
from backend.config import Settings, get_settings
from backend.db import create_engine
from backend.game_routes import router as game_router
from backend.library import load_library_in_background
from backend.meta import SERVICE_VERSION
from backend.routes import router
from backend.sockets import create_socket_server


def create_app(settings: Settings | None = None) -> socketio.ASGIApp:
    """Build the ASGI app: Socket.IO on /socket.io, FastAPI for everything else.

    Run with: uvicorn backend.main:create_app --factory
    """
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.engine = create_engine(settings.database_url)
        app.state.ai_client = AIClient(settings.ai_service_url, settings.internal_api_key)
        library = asyncio.create_task(
            load_library_in_background(app.state.engine, app.state.ai_client, settings.cases_dir)
        )
        yield
        library.cancel()
        with suppress(asyncio.CancelledError):
            await library
        await app.state.ai_client.aclose()
        await app.state.engine.dispose()

    api = FastAPI(
        title="Murder Mystery — Backend",
        version=SERVICE_VERSION,
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    api.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    api.include_router(router)
    api.include_router(game_router)

    sio = create_socket_server(settings.cors_origins, lambda: api.state.engine)
    return socketio.ASGIApp(sio, other_asgi_app=api)
