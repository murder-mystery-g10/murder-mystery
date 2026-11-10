"""Shared investigation board: rules and persistence (docs/database.md).

Every change is written to board_items / board_links right away; the whole board is then
sent to the lobby as board:state and is part of game:snapshot. A pinned clue carries its card:
notebooks are personal, so the board is how the team shares what each player found.
"""

import uuid

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend import exploration
from backend.models import (
    BoardItem,
    BoardLink,
    CaseRecord,
    FoundClue,
    InterrogationEntry,
    Lobby,
    Player,
)
from shared_schemas import STATION
from shared_schemas.case import Case
from shared_schemas.game_api import (
    BoardAddNote,
    BoardConnect,
    BoardEditNote,
    BoardItemKind,
    BoardMove,
    BoardPin,
    BoardRemove,
    BoardState,
    ClueCard,
    LobbyStatus,
)
from shared_schemas.game_api import BoardItem as BoardItemOut
from shared_schemas.game_api import BoardLink as BoardLinkOut


class BoardError(Exception):
    """A board rule was broken. The message is shown to the player."""


def _parse_id(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise BoardError("The item is not on the board.") from None


async def load_board(db: AsyncSession, lobby_id: uuid.UUID, case: Case | None = None) -> BoardState:
    """The whole board of a lobby, for board:state and game:snapshot.

    Pass the lobby's case if it is already loaded; otherwise it is read here.
    """
    if case is None:
        case = await _lobby_case(db, lobby_id)
    items = await db.scalars(
        select(BoardItem).where(BoardItem.lobby_id == lobby_id).order_by(BoardItem.created_at)
    )
    links = await db.scalars(
        select(BoardLink).where(BoardLink.lobby_id == lobby_id).order_by(BoardLink.created_at)
    )
    return BoardState(
        items=[
            BoardItemOut(
                id=str(item.id),
                kind=item.kind,
                ref=item.ref,
                text=item.text,
                x=item.x,
                y=item.y,
                added_by=str(item.added_by),
                clue=_pinned_clue(case, item),
            )
            for item in items
        ],
        links=[
            BoardLinkOut(id=str(link.id), source=str(link.source_id), target=str(link.target_id))
            for link in links
        ],
    )


async def _lobby_case(db: AsyncSession, lobby_id: uuid.UUID) -> Case | None:
    lobby = await db.get(Lobby, lobby_id)
    record = await db.get(CaseRecord, lobby.case_id) if lobby and lobby.case_id else None
    return Case.model_validate(record.data) if record else None


def _pinned_clue(case: Case | None, item: BoardItem) -> ClueCard | None:
    """The card of a pinned clue; the player who pinned it is the one who found it."""
    if case is None or item.kind != BoardItemKind.CLUE or item.ref is None:
        return None
    return exploration.clue_card(case, item.ref, item.added_by)


async def _check_can_edit(db: AsyncSession, player: Player) -> Lobby:
    lobby = await db.get(Lobby, player.lobby_id)
    if lobby is None or lobby.status != LobbyStatus.PLAYING:
        raise BoardError("The game is not in progress.")
    if player.location != STATION:
        raise BoardError("You can only change the board at the police station.")
    return lobby


async def _get_item(db: AsyncSession, player: Player, item_id: str) -> BoardItem:
    item = await db.get(BoardItem, _parse_id(item_id))
    if item is None or item.lobby_id != player.lobby_id:
        raise BoardError("The item is not on the board.")
    return item


async def pin(db: AsyncSession, player: Player, data: BoardPin) -> None:
    lobby = await _check_can_edit(db, player)
    if data.kind == "clue":
        found = await db.get(FoundClue, (player.lobby_id, player.id, data.ref))
        if found is None:
            raise BoardError("You can only pin clues from your notebook.")
    elif data.kind == "suspect":
        case = await db.get(CaseRecord, lobby.case_id)
        suspect_ids = {suspect["id"] for suspect in case.data["suspects"]} if case else set()
        if data.ref not in suspect_ids:
            raise BoardError("Unknown suspect.")
    else:  # quote: an answered interrogation question
        entry = await db.get(InterrogationEntry, _parse_id(data.ref))
        if entry is None or entry.lobby_id != player.lobby_id:
            raise BoardError("Unknown quote.")
    db.add(
        BoardItem(
            lobby_id=player.lobby_id,
            kind=BoardItemKind(data.kind),
            ref=data.ref,
            x=data.x,
            y=data.y,
            added_by=player.id,
        )
    )


async def add_note(db: AsyncSession, player: Player, data: BoardAddNote) -> None:
    await _check_can_edit(db, player)
    db.add(
        BoardItem(
            lobby_id=player.lobby_id,
            kind=BoardItemKind.NOTE,
            text=data.text,
            x=data.x,
            y=data.y,
            added_by=player.id,
        )
    )


async def edit_note(db: AsyncSession, player: Player, data: BoardEditNote) -> None:
    await _check_can_edit(db, player)
    item = await _get_item(db, player, data.item)
    if item.kind != BoardItemKind.NOTE:
        raise BoardError("Only notes can be edited.")
    item.text = data.text


async def move(db: AsyncSession, player: Player, data: BoardMove) -> None:
    await _check_can_edit(db, player)
    item = await _get_item(db, player, data.item)
    item.x = data.x
    item.y = data.y


async def connect(db: AsyncSession, player: Player, data: BoardConnect) -> None:
    await _check_can_edit(db, player)
    if data.source == data.target:
        raise BoardError("An item cannot be linked to itself.")
    source = await _get_item(db, player, data.source)
    target = await _get_item(db, player, data.target)
    existing = await db.scalar(
        select(BoardLink.id).where(
            BoardLink.lobby_id == player.lobby_id,
            or_(
                and_(BoardLink.source_id == source.id, BoardLink.target_id == target.id),
                and_(BoardLink.source_id == target.id, BoardLink.target_id == source.id),
            ),
        )
    )
    if existing is not None:
        raise BoardError("These items are already linked.")
    db.add(BoardLink(lobby_id=player.lobby_id, source_id=source.id, target_id=target.id))


async def remove(db: AsyncSession, player: Player, data: BoardRemove) -> None:
    """Remove an item (its links go with it: ON DELETE CASCADE) or a single link."""
    await _check_can_edit(db, player)
    target_id = _parse_id(data.id)
    result = await db.execute(
        delete(BoardItem).where(BoardItem.id == target_id, BoardItem.lobby_id == player.lobby_id)
    )
    if result.rowcount:
        return
    result = await db.execute(
        delete(BoardLink).where(BoardLink.id == target_id, BoardLink.lobby_id == player.lobby_id)
    )
    if not result.rowcount:
        raise BoardError("The item is not on the board.")
