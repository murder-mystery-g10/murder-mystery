import logging

import socketio

logger = logging.getLogger(__name__)


def create_socket_server(cors_origins: list[str]) -> socketio.AsyncServer:
    """Socket.IO server. Event names follow the `domain:action` convention."""
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=cors_origins)

    @sio.event
    async def connect(sid: str, environ: dict, auth: dict | None = None) -> None:
        logger.info("client connected: %s", sid)

    @sio.event
    async def disconnect(sid: str, reason: str | None = None) -> None:
        logger.info("client disconnected: %s (%s)", sid, reason)

    @sio.on("system:ping")
    async def ping(sid: str, data: object = None) -> dict[str, str]:
        return {"message": "pong"}

    return sio
