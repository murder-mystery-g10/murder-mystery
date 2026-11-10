"""Lobby and game start: picking the case, starting the game and each player's snapshot.

Who is online is not stored in the database (docs/database.md); the Socket.IO server keeps it
and passes the ids of the connected players in.

A snapshot is everything one player may see. It is built from the case without the solution:
no truth, no secrets, no correct accusation answers and no reveal. Only once the game has ended
does it carry the result, which holds the correct answers and the reveal.
"""

import uuid
from collections.abc import Collection
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend import accusation as accusation_rules
from backend import board, exploration, interrogation
from backend.models import Accusation as AccusationRow
from backend.models import (
    AccusationStatus,
    AccusationVote,
    CaseRecord,
    FoundClue,
    InterrogationEntry,
    Lobby,
    Player,
)
from shared_schemas.case import Case
from shared_schemas.game_api import (
    AccusationChoices,
    AccusationOptions,
    AccusationProposal,
    BoardState,
    CaseSummary,
    ClueCard,
    GameResult,
    GameSnapshot,
    LobbyState,
    LobbyStatus,
    PresenceUpdate,
    RoomAccess,
    SelectCase,
    StartGame,
    SuspectCard,
    SuspectInterrogation,
)
from shared_schemas.game_api import Player as PlayerOut


class LobbyError(Exception):
    """A lobby rule was broken. The message is shown to the player."""


# --- reading -------------------------------------------------------------------------


async def lobby_players(db: AsyncSession, lobby_id: uuid.UUID) -> list[Player]:
    """Players of a lobby in the order they joined."""
    players = await db.scalars(
        select(Player).where(Player.lobby_id == lobby_id).order_by(Player.joined_at, Player.id)
    )
    return list(players)


def player_out(player: Player, connected: Collection[uuid.UUID]) -> PlayerOut:
    return PlayerOut(
        id=str(player.id),
        name=player.name,
        is_host=player.is_host,
        connected=player.id in connected,
        location=player.location,
    )


def case_summary(record: CaseRecord) -> CaseSummary:
    return CaseSummary(
        case_id=record.id,
        title=record.title,
        difficulty=record.difficulty,
        player_count=record.player_count,
        summary=record.data["briefing"]["summary"],
    )


async def load_lobby_state(
    db: AsyncSession, lobby: Lobby, connected: Collection[uuid.UUID]
) -> LobbyState:
    """Payload of lobby:state."""
    record = await db.get(CaseRecord, lobby.case_id) if lobby.case_id else None
    return LobbyState(
        code=lobby.code,
        status=lobby.status,
        solo=lobby.solo,
        players=[player_out(p, connected) for p in await lobby_players(db, lobby.id)],
        case=case_summary(record) if record else None,
    )


async def load_presence(
    db: AsyncSession, lobby_id: uuid.UUID, connected: Collection[uuid.UUID]
) -> PresenceUpdate:
    """Payload of presence:update."""
    players = await lobby_players(db, lobby_id)
    return PresenceUpdate(players=[player_out(p, connected) for p in players])


# --- lobby events --------------------------------------------------------------------


async def _waiting_lobby_as_host(db: AsyncSession, player: Player) -> Lobby:
    lobby = await db.get(Lobby, player.lobby_id)
    if lobby is None:
        raise LobbyError("You are not in a game.")
    if not player.is_host:
        raise LobbyError("Only the host can do that.")
    if lobby.status != LobbyStatus.WAITING:
        raise LobbyError("The game has already started.")
    return lobby


async def select_case(db: AsyncSession, player: Player, data: SelectCase) -> None:
    """lobby:select_case: the host picks a case from the library."""
    lobby = await _waiting_lobby_as_host(db, player)
    if await db.get(CaseRecord, data.case_id) is None:
        raise LobbyError("Unknown case.")
    lobby.case_id = data.case_id


def assign_slots(case: Case, players: list[Player], solo: bool) -> list[str | None]:
    """The case's player slot (J1, J2, ...) for each player, in join order.

    The game needs exactly the case's player count. Solo test mode skips that check and gives
    no slot: the player sees every room (`exploration.player_rooms`).
    """
    if solo:
        return [None] * len(players)
    if len(players) != case.player_count:
        raise LobbyError(f"This case needs {case.player_count} players.")
    return [slot.id for slot in case.players[: len(players)]]


async def start_game(db: AsyncSession, player: Player, data: StartGame) -> None:
    """lobby:start: the host starts the game with the selected case."""
    lobby = await _waiting_lobby_as_host(db, player)
    record = await db.get(CaseRecord, lobby.case_id) if lobby.case_id else None
    if record is None:
        raise LobbyError("Pick a case first.")
    case = Case.model_validate(record.data)
    players = await lobby_players(db, lobby.id)
    for each, slot in zip(players, assign_slots(case, players, lobby.solo), strict=True):
        each.slot = slot
    lobby.status = LobbyStatus.PLAYING
    lobby.started_at = datetime.now(UTC)


# --- snapshot ------------------------------------------------------------------------


def suspect_cards(case: Case) -> list[SuspectCard]:
    return [
        SuspectCard(
            id=suspect.id,
            name=suspect.name,
            role=suspect.role,
            archetype=suspect.archetype,
            initial_statement=suspect.initial_statement,
        )
        for suspect in case.suspects
    ]


def accusation_options(case: Case) -> AccusationOptions:
    """The choices only; the correct answers stay on the server."""
    return AccusationOptions(
        motive_options=case.accusation.motive_options,
        method_options=case.accusation.method_options,
    )


def notebook(case: Case, player_id: uuid.UUID, clue_ids: list[str]) -> list[ClueCard]:
    """The player's found clues, in the order they were found."""
    cards = (exploration.clue_card(case, clue_id, player_id) for clue_id in clue_ids)
    return [card for card in cards if card is not None]


def interrogations(case: Case, entries: list[InterrogationEntry]) -> list[SuspectInterrogation]:
    """Every suspect's dialogue so far and the team's questions left for them."""
    result = []
    for suspect in case.suspects:
        asked = [entry for entry in entries if entry.suspect == suspect.id]
        result.append(
            SuspectInterrogation(
                suspect=suspect.id,
                questions_left=interrogation.questions_left(case, len(asked)),
                entries=[interrogation.entry_out(entry) for entry in asked],
            )
        )
    return result


def accusation_proposal(
    accusation: AccusationRow | None, votes: list[AccusationVote]
) -> AccusationProposal | None:
    if accusation is None:
        return None
    return AccusationProposal(
        id=str(accusation.id),
        proposed_by=str(accusation.proposed_by),
        choices=AccusationChoices(
            culprit=accusation.culprit, motive=accusation.motive, method=accusation.method
        ),
        votes={str(vote.player_id): vote.accept for vote in votes},
    )


def build_snapshot(
    *,
    case: Case,
    lobby: LobbyState,
    you: uuid.UUID,
    started_at: datetime,
    rooms: list[RoomAccess],
    found_clue_ids: list[str],
    board_state: BoardState,
    entries: list[InterrogationEntry],
    accusation: AccusationRow | None,
    votes: list[AccusationVote],
    result: GameResult | None = None,
) -> GameSnapshot:
    """game:snapshot for one player, from data already loaded from the database."""
    return GameSnapshot(
        lobby=lobby,
        you=str(you),
        theme=case.theme,
        started_at=started_at,
        briefing=case.briefing,
        rooms=rooms,
        notebook=notebook(case, you, found_clue_ids),
        board=board_state,
        suspects=suspect_cards(case),
        interrogations=interrogations(case, entries),
        accusation_options=accusation_options(case),
        accusation=accusation_proposal(accusation, votes),
        result=result,
    )


async def load_snapshot(
    db: AsyncSession, player: Player, connected: Collection[uuid.UUID]
) -> GameSnapshot:
    """game:snapshot for one player of a game in progress or one that has ended."""
    game = await exploration.load_game(db, player, finished=True)
    found = await db.scalars(
        select(FoundClue.clue_id)
        .where(FoundClue.lobby_id == player.lobby_id, FoundClue.player_id == player.id)
        .order_by(FoundClue.found_at)
    )
    entries = await db.scalars(
        select(InterrogationEntry)
        .where(InterrogationEntry.lobby_id == player.lobby_id)
        .order_by(InterrogationEntry.created_at)
    )
    accusation = await db.scalar(
        select(AccusationRow).where(
            AccusationRow.lobby_id == player.lobby_id,
            AccusationRow.status == AccusationStatus.PENDING,
        )
    )
    votes = (
        await db.scalars(
            select(AccusationVote).where(AccusationVote.accusation_id == accusation.id)
        )
        if accusation
        else []
    )
    assert game.lobby.started_at is not None, "a game in progress has a start time"
    return build_snapshot(
        case=game.case,
        lobby=await load_lobby_state(db, game.lobby, connected),
        you=player.id,
        started_at=game.lobby.started_at,
        rooms=await exploration.room_access(db, game, player),
        found_clue_ids=list(found),
        board_state=await board.load_board(db, player.lobby_id, game.case),
        entries=list(entries),
        accusation=accusation,
        votes=list(votes),
        result=await accusation_rules.load_result(db, game),
    )
