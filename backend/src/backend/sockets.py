import hashlib
import logging
import uuid
from collections.abc import Awaitable, Callable

import socketio
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from backend import board
from backend.models import Lobby, Player
from shared_schemas.game_api import (
    Ack,
    BoardAddNote,
    BoardConnect,
    BoardEditNote,
    BoardMove,
    BoardPin,
    BoardRemove,
)

logger = logging.getLogger(__name__)


def create_socket_server(
    cors_origins: list[str], get_engine: Callable[[], AsyncEngine] | None = None
) -> socketio.AsyncServer:
    """Socket.IO server. Event names follow the `domain:action` convention.

    `get_engine` returns the database engine; it is a callable because the engine is created
    in the app's lifespan, after this server is built.
    """
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=cors_origins)

    def _db() -> AsyncSession:
        assert get_engine is not None, "create_socket_server needs get_engine for game events"
        return AsyncSession(get_engine(), expire_on_commit=False)

    def _error(message: str) -> dict:
        return Ack(ok=False, error=message).model_dump(mode="json")

    @sio.event
    async def connect(sid: str, environ: dict, auth: dict | None = None) -> bool:
        """Without auth (e.g. the status page): connect, but only system:ping works.
        With `SocketAuth` (lobby code + player token): refuse a wrong token, otherwise join the
        lobby's room so the player gets its updates."""
        auth = auth or {}
        token, code = auth.get("player_token"), auth.get("lobby_code")
        if not token and not code:
            logger.info("client connected without a game: %s", sid)
            return True
        if not token or not code or get_engine is None:
            return False
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        async with _db() as db:
            player = await db.scalar(
                select(Player)
                .join(Lobby, Lobby.id == Player.lobby_id)
                .where(Player.token_hash == token_hash, Lobby.code == code)
            )
            if player is None:
                return False
            state = await board.load_board(db, player.lobby_id)
        await sio.save_session(sid, {"player_id": str(player.id), "lobby_id": str(player.lobby_id)})
        await sio.enter_room(sid, str(player.lobby_id))
        # Temporary until game:snapshot (which includes the board) is sent on connect.
        await sio.emit("board:state", state.model_dump(mode="json"), to=sid)
        logger.info("player %s connected: %s", player.id, sid)
        return True

    @sio.event
    async def disconnect(sid: str, reason: str | None = None) -> None:
        logger.info("client disconnected: %s (%s)", sid, reason)

    @sio.on("system:ping")
    async def ping(sid: str, data: object = None) -> dict[str, str]:
        return {"message": "pong"}

    def _board_event(
        event: str,
        schema: type[BaseModel],
        action: Callable[[AsyncSession, Player, BaseModel], Awaitable[None]],
    ) -> None:
        """Register a board event: validate, apply, save, then send board:state to the lobby."""

        @sio.on(event)
        async def handler(sid: str, data: object = None) -> dict:
            try:
                payload = schema.model_validate(data or {})
            except ValidationError:
                return _error("Invalid data.")
            player_id = (await sio.get_session(sid)).get("player_id")
            if player_id is None:
                return _error("You are not in a game.")
            async with _db() as db:
                player = await db.get(Player, uuid.UUID(player_id))
                if player is None:
                    return _error("You are not in a game.")
                try:
                    await action(db, player, payload)
                except board.BoardError as error:
                    await db.rollback()
                    return _error(str(error))
                await db.commit()
                state = await board.load_board(db, player.lobby_id)
            await sio.emit("board:state", state.model_dump(mode="json"), room=str(player.lobby_id))
            return Ack(ok=True).model_dump(mode="json")

    _board_event("board:pin", BoardPin, board.pin)
    _board_event("board:add_note", BoardAddNote, board.add_note)
    _board_event("board:edit_note", BoardEditNote, board.edit_note)
    _board_event("board:move", BoardMove, board.move)
    _board_event("board:connect", BoardConnect, board.connect)
    _board_event("board:remove", BoardRemove, board.remove)

    return sio
