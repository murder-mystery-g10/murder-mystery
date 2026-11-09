"""Creating and joining a lobby (REST). Everything after that goes through Socket.IO.

The player token is returned once, in `LobbySession`; only its SHA-256 is stored
(`players.token_hash`), and the Socket.IO handshake checks it the same way.
"""

import hashlib
import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.lobby import LobbyError, lobby_players
from backend.models import Lobby, Player
from shared_schemas.game_api import (
    CreateLobbyRequest,
    JoinLobbyRequest,
    LobbySession,
    LobbyStatus,
)

MAX_PLAYERS = 6
# No 0/O or 1/I, so a code read aloud or from a screen is not mistyped.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
NAME_TAKEN = "That name is already taken in this lobby. Choose another name."


class LobbyNotFound(Exception):
    """No lobby has this code."""


class InvalidName(Exception):
    """The player name is empty once spaces are removed."""


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def normalize_code(code: str) -> str:
    """Codes are typed by players: ignore spaces and case."""
    return code.strip().upper()


def _clean_name(name: str) -> str:
    name = name.strip()
    if not name:
        raise InvalidName("Enter a name.")
    return name


async def _unused_code(db: AsyncSession) -> str:
    for _ in range(20):
        code = new_code()
        if await db.scalar(select(Lobby.id).where(Lobby.code == code)) is None:
            return code
    raise RuntimeError("could not find a free lobby code")


def _new_player(lobby: Lobby, name: str, is_host: bool) -> tuple[Player, LobbySession]:
    token = secrets.token_urlsafe(32)
    player = Player(
        id=uuid.uuid4(),
        lobby_id=lobby.id,
        name=name,
        is_host=is_host,
        token_hash=hash_token(token),
    )
    session = LobbySession(lobby_code=lobby.code, player_id=str(player.id), player_token=token)
    return player, session


async def create_lobby(db: AsyncSession, data: CreateLobbyRequest) -> LobbySession:
    """POST /api/lobbies: a new lobby, waiting for players; the creator is the host."""
    name = _clean_name(data.player_name)
    lobby = Lobby(
        id=uuid.uuid4(), code=await _unused_code(db), status=LobbyStatus.WAITING, solo=data.solo
    )
    db.add(lobby)
    await db.flush()
    player, session = _new_player(lobby, name, is_host=True)
    db.add(player)
    await db.commit()
    return session


async def join_lobby(db: AsyncSession, code: str, data: JoinLobbyRequest) -> LobbySession:
    """POST /api/lobbies/{code}/join: join a lobby that is still waiting for players."""
    name = _clean_name(data.player_name)
    lobby = await db.scalar(select(Lobby).where(Lobby.code == normalize_code(code)))
    if lobby is None:
        raise LobbyNotFound
    if lobby.status != LobbyStatus.WAITING:
        raise LobbyError("The game has already started.")
    if lobby.solo:
        raise LobbyError("This is a solo test lobby; nobody else can join.")
    players = await lobby_players(db, lobby.id)
    if len(players) >= MAX_PLAYERS:
        raise LobbyError(f"The lobby is full ({MAX_PLAYERS} players).")
    if any(player.name.casefold() == name.casefold() for player in players):
        raise LobbyError(NAME_TAKEN)

    player, session = _new_player(lobby, name, is_host=False)
    db.add(player)
    try:
        await db.commit()
    except IntegrityError:  # someone took the same name a moment earlier
        await db.rollback()
        raise LobbyError(NAME_TAKEN) from None
    return session
