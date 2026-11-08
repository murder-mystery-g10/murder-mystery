import hashlib
import logging
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import socketio
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from backend import board, exploration
from backend.models import Lobby, Player
from shared_schemas.game_api import (
    Ack,
    BoardAddNote,
    BoardConnect,
    BoardEditNote,
    BoardMove,
    BoardPin,
    BoardRemove,
    EnterRoom,
    InspectAck,
    InspectObject,
    RoomUnlocked,
    UnlockRoom,
)

logger = logging.getLogger(__name__)

# Rule errors whose message is sent back to the player in the ack.
GAME_ERRORS = (board.BoardError, exploration.ExplorationError)


class Refused(Exception):
    """The event is refused; the message goes into the ack."""


def lobby_room(lobby_id: uuid.UUID) -> str:
    """Socket.IO room with every connection of a lobby."""
    return str(lobby_id)


def player_room(player_id: uuid.UUID) -> str:
    """Socket.IO room with every connection (tab, device) of one player."""
    return f"player:{player_id}"


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

    def _ok() -> dict:
        return Ack(ok=True).model_dump(mode="json")

    async def _apply(
        sid: str,
        data: object,
        schema: type[BaseModel],
        action: Callable[[AsyncSession, Player, Any], Awaitable[Any]],
    ) -> tuple[Player, Any]:
        """Validate the payload, run the action for this connection's player and commit.

        Returns the player and the action's result; raises `Refused` with the ack message.
        """
        try:
            payload = schema.model_validate(data or {})
        except ValidationError:
            raise Refused("Invalid data.") from None
        player_id = (await sio.get_session(sid)).get("player_id")
        if player_id is None:
            raise Refused("You are not in a game.")
        async with _db() as db:
            player = await db.get(Player, uuid.UUID(player_id))
            if player is None:
                raise Refused("You are not in a game.")
            try:
                result = await action(db, player, payload)
            except GAME_ERRORS as error:
                await db.rollback()
                raise Refused(str(error)) from None
            await db.commit()
        return player, result

    # --- connection ---------------------------------------------------------------------

    @sio.event
    async def connect(sid: str, environ: dict, auth: dict | None = None) -> bool:
        """Without auth (e.g. the status page): connect, but only system:ping works.

        With `SocketAuth` (lobby code + player token): refuse a wrong token, otherwise join the
        lobby's room and the player's own room so they get their updates.
        """
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
        await sio.enter_room(sid, lobby_room(player.lobby_id))
        await sio.enter_room(sid, player_room(player.id))
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

    # --- exploration --------------------------------------------------------------------

    @sio.on("room:enter")
    async def room_enter(sid: str, data: object = None) -> dict:
        try:
            await _apply(sid, data, EnterRoom, exploration.enter_room)
        except Refused as refused:
            return _error(str(refused))
        return _ok()

    @sio.on("object:inspect")
    async def object_inspect(sid: str, data: object = None) -> dict:
        try:
            _, clues = await _apply(sid, data, InspectObject, exploration.inspect_object)
        except Refused as refused:
            return InspectAck(ok=False, error=str(refused)).model_dump(mode="json")
        return InspectAck(ok=True, clues=clues).model_dump(mode="json")

    @sio.on("room:unlock")
    async def room_unlock(sid: str, data: object = None) -> dict:
        try:
            player, with_access = await _apply(sid, data, UnlockRoom, exploration.unlock_room)
        except Refused as refused:
            return _error(str(refused))
        event = RoomUnlocked(room=data["room"], by=str(player.id)).model_dump(mode="json")
        for player_id in with_access:
            await sio.emit("room:unlocked", event, room=player_room(player_id))
        return _ok()

    # --- board --------------------------------------------------------------------------

    def _board_event(
        event: str,
        schema: type[BaseModel],
        action: Callable[[AsyncSession, Player, Any], Awaitable[None]],
    ) -> None:
        """Register a board event: apply it, then send board:state to the whole lobby."""

        @sio.on(event)
        async def handler(sid: str, data: object = None) -> dict:
            try:
                player, _ = await _apply(sid, data, schema, action)
            except Refused as refused:
                return _error(str(refused))
            async with _db() as db:
                state = await board.load_board(db, player.lobby_id)
            await sio.emit(
                "board:state", state.model_dump(mode="json"), room=lobby_room(player.lobby_id)
            )
            return _ok()

    _board_event("board:pin", BoardPin, board.pin)
    _board_event("board:add_note", BoardAddNote, board.add_note)
    _board_event("board:edit_note", BoardEditNote, board.edit_note)
    _board_event("board:move", BoardMove, board.move)
    _board_event("board:connect", BoardConnect, board.connect)
    _board_event("board:remove", BoardRemove, board.remove)

    return sio
