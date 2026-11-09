"""Exploration: entering rooms, inspecting objects and unlocking doors.

Which rooms a player may use comes from their slot in the case (`Case.players`); in solo mode
one player has every room. Rooms without a lock are open from the start; the others are open
once they have a row in `unlocked_rooms`.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import CaseRecord, FoundClue, Lobby, Player, UnlockedRoom
from shared_schemas import STATION
from shared_schemas.case import Case, Clue, KeyLock
from shared_schemas.game_api import (
    ClueCard,
    EnterRoom,
    InspectObject,
    LobbyStatus,
    RoomAccess,
    UnlockRoom,
)


class ExplorationError(Exception):
    """A rule was broken. The message is shown to the player."""


@dataclass
class Game:
    lobby: Lobby
    case: Case


async def load_game(db: AsyncSession, player: Player, *, finished: bool = False) -> Game:
    """The player's game in progress; with `finished`, also a game that has ended."""
    allowed = {LobbyStatus.PLAYING, LobbyStatus.FINISHED} if finished else {LobbyStatus.PLAYING}
    lobby = await db.get(Lobby, player.lobby_id)
    if lobby is None or lobby.status not in allowed or lobby.case_id is None:
        raise ExplorationError("The game is not in progress.")
    record = await db.get(CaseRecord, lobby.case_id)
    if record is None:
        raise ExplorationError("The game is not in progress.")
    return Game(lobby=lobby, case=Case.model_validate(record.data))


def player_rooms(game: Game, player: Player) -> set[str]:
    """Rooms this player handles: their slot's rooms, or every room in solo mode."""
    if game.lobby.solo:
        return {room.room for room in game.case.rooms}
    slot = next((slot for slot in game.case.players if slot.id == player.slot), None)
    return set(slot.rooms) if slot else set()


def object_room(object_id: str) -> str:
    """Room of a map object: object ids are '<room>.<object>' (theme map convention).

    Switch to `ThemeMap.object_rooms()` once themes/<theme>/map.json exists.
    """
    return object_id.split(".", 1)[0]


def findable_clues(game: Game, player: Player, object_id: str) -> list[Clue]:
    """Clues on an object that this player can find.

    A key clue (`KeyLock.key_clue`) is only found by a player who has access to the room it
    opens; for anyone else the object holds nothing.
    """
    rooms = player_rooms(game, player)
    opens = {
        room.lock.key_clue: room.room for room in game.case.rooms if isinstance(room.lock, KeyLock)
    }
    return [
        clue
        for clue in game.case.clues
        if clue.object == object_id and (clue.id not in opens or opens[clue.id] in rooms)
    ]


async def unlocked_rooms(db: AsyncSession, game: Game) -> set[str]:
    opened = await db.scalars(
        select(UnlockedRoom.room).where(UnlockedRoom.lobby_id == game.lobby.id)
    )
    return {room.room for room in game.case.rooms if room.lock is None} | set(opened)


async def room_access(db: AsyncSession, game: Game, player: Player) -> list[RoomAccess]:
    """The `rooms` list of game:snapshot for one player."""
    rooms = player_rooms(game, player)
    unlocked = await unlocked_rooms(db, game)
    return [
        RoomAccess(
            room=room.room,
            yours=room.room in rooms,
            unlocked=room.room in unlocked,
            lock=room.lock.type if room.lock else None,
        )
        for room in game.case.rooms
    ]


async def enter_room(db: AsyncSession, player: Player, data: EnterRoom) -> None:
    game = await load_game(db, player)
    if data.room != STATION:
        if data.room not in player_rooms(game, player):
            raise ExplorationError("Another team handles this room.")
        if data.room not in await unlocked_rooms(db, game):
            raise ExplorationError("The door is locked.")
    player.location = data.room


def object_text(case: Case, object_id: str) -> str | None:
    """The case's text for an object without clues, if it has one."""
    return next((t.text for t in case.object_texts if t.object == object_id), None)


async def inspect_object(
    db: AsyncSession, player: Player, data: InspectObject
) -> tuple[list[ClueCard], str | None]:
    """Put the object's clues in the player's notebook.

    Returns the clues found, and, when there are none, the object's text from the case
    (None: the frontend shows 'Nothing of interest.').
    """
    game = await load_game(db, player)
    room = object_room(data.object)
    if player.location != room:
        raise ExplorationError("You are not in that room.")
    cards = []
    for clue in findable_clues(game, player, data.object):
        await db.execute(
            insert(FoundClue)
            .values(lobby_id=player.lobby_id, player_id=player.id, clue_id=clue.id)
            .on_conflict_do_nothing()
        )
        cards.append(
            ClueCard(
                id=clue.id,
                title=clue.title,
                icon=clue.icon,
                text=clue.player_text,
                room=room,
                found_by=str(player.id),
            )
        )
    return cards, None if cards else object_text(game.case, data.object)


async def unlock_room(db: AsyncSession, player: Player, data: UnlockRoom) -> list[uuid.UUID]:
    """Open a locked room. Returns the ids of the players who have access to it."""
    game = await load_game(db, player)
    case_room = next((room for room in game.case.rooms if room.room == data.room), None)
    if case_room is None or case_room.lock is None:
        raise ExplorationError("This door is not locked.")
    if data.room not in player_rooms(game, player):
        raise ExplorationError("Another team handles this room.")
    if data.room in await unlocked_rooms(db, game):
        raise ExplorationError("This door is already open.")

    lock = case_room.lock
    if isinstance(lock, KeyLock):
        if data.key_clue is None:
            raise ExplorationError("Use a key from your notebook.")
        in_notebook = await db.get(FoundClue, (player.lobby_id, player.id, data.key_clue))
        if in_notebook is None:
            raise ExplorationError("That key is not in your notebook.")
        if data.key_clue != lock.key_clue:
            raise ExplorationError("This key does not fit the door.")
    elif (data.code or "").strip() != lock.code:
        raise ExplorationError("Wrong code.")

    await db.execute(
        insert(UnlockedRoom)
        .values(lobby_id=player.lobby_id, room=data.room, unlocked_by=player.id)
        .on_conflict_do_nothing()
    )
    players = await db.scalars(select(Player).where(Player.lobby_id == player.lobby_id))
    return [other.id for other in players if data.room in player_rooms(game, other)]
