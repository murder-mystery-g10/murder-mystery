"""Final accusation: a proposal, a unanimous vote, then the score and the end of the game.

Rules (issue #20, docs/database.md):
- One proposal waits for votes at a time. Every player of the lobby must accept it.
- One rejection rejects the proposal; the team can propose again.
- An accepted proposal is the team's only attempt: the game ends and is scored.
- Score: 50 culprit + 25 motive + 25 method; time bonus +20 under 35 min, down to 0 at 55 min,
  then -1 per minute, at most -20; +1 per unused question.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend import exploration
from backend.models import Accusation as AccusationRow
from backend.models import (
    AccusationStatus,
    AccusationVote,
    FoundClue,
    InterrogationEntry,
    Player,
)
from backend.models import GameResult as GameResultRow
from shared_schemas.case import Case
from shared_schemas.game_api import (
    AccusationChoices,
    GameResult,
    LobbyStatus,
    MissedClue,
    ScoreBreakdown,
    VoteAccusation,
)

CULPRIT_POINTS = 50
MOTIVE_POINTS = 25
METHOD_POINTS = 25
# The time bonus is 55 minus the minutes played, kept between -20 and +20: +20 under 35 minutes,
# 0 at 55 minutes, then -1 per minute down to -20.
TIME_BONUS_ZERO_AT_MINUTES = 55
TIME_BONUS_LIMIT = 20


class AccusationError(Exception):
    """An accusation rule was broken. The message is shown to the player."""


@dataclass
class VoteOutcome:
    """What a vote changed: the proposal, and the result when it ended the game."""

    accusation: AccusationRow
    result: GameResult | None = None


# --- rules ---------------------------------------------------------------------------


def check_choices(case: Case, choices: AccusationChoices) -> None:
    if choices.culprit not in {suspect.id for suspect in case.suspects}:
        raise AccusationError("Unknown suspect.")
    if choices.motive not in {option.id for option in case.accusation.motive_options}:
        raise AccusationError("Unknown motive.")
    if choices.method not in {option.id for option in case.accusation.method_options}:
        raise AccusationError("Unknown method.")


def correct_choices(case: Case) -> AccusationChoices:
    return AccusationChoices(
        culprit=case.truth.culprit,
        motive=case.accusation.correct_motive,
        method=case.accusation.correct_method,
    )


def everyone_accepted(players: list[uuid.UUID], accepted: set[uuid.UUID]) -> bool:
    """The vote is unanimous: every player of the lobby accepted, offline players included."""
    return all(player_id in accepted for player_id in players)


def time_bonus(elapsed_seconds: int) -> int:
    """Whole minutes count: 35 min 50 s is 35 minutes."""
    minutes = elapsed_seconds // 60
    return max(-TIME_BONUS_LIMIT, min(TIME_BONUS_LIMIT, TIME_BONUS_ZERO_AT_MINUTES - minutes))


def unused_questions(case: Case, asked_suspects: list[str]) -> int:
    """Questions the team did not use, over every suspect."""
    return sum(
        max(case.questions_per_suspect - asked_suspects.count(suspect.id), 0)
        for suspect in case.suspects
    )


def score(
    case: Case, chosen: AccusationChoices, elapsed_seconds: int, unused: int
) -> ScoreBreakdown:
    correct = correct_choices(case)
    culprit = CULPRIT_POINTS if chosen.culprit == correct.culprit else 0
    motive = MOTIVE_POINTS if chosen.motive == correct.motive else 0
    method = METHOD_POINTS if chosen.method == correct.method else 0
    bonus = time_bonus(elapsed_seconds)
    return ScoreBreakdown(
        culprit=culprit,
        motive=motive,
        method=method,
        time_bonus=bonus,
        unused_questions=unused,
        total=culprit + motive + method + bonus + unused,
        elapsed_seconds=elapsed_seconds,
    )


def missed_clues(case: Case, found: set[str]) -> list[MissedClue]:
    """Clues nobody in the team found."""
    return [
        MissedClue(
            id=clue.id,
            title=clue.title,
            icon=clue.icon,
            text=clue.player_text,
            room=exploration.object_room(clue.object),
        )
        for clue in case.clues
        if clue.id not in found
    ]


def game_result(
    case: Case, chosen: AccusationChoices, breakdown: ScoreBreakdown, found: set[str]
) -> GameResult:
    """game:ended, and the `result` of the snapshot once the game has ended."""
    return GameResult(
        chosen=chosen,
        correct=correct_choices(case),
        score=breakdown,
        reveal=case.reveal,
        missed_clues=missed_clues(case, found),
    )


def stored_score(row: GameResultRow) -> ScoreBreakdown:
    return ScoreBreakdown(
        culprit=row.culprit_points,
        motive=row.motive_points,
        method=row.method_points,
        time_bonus=row.time_bonus,
        unused_questions=row.unused_questions_bonus,
        total=row.total,
        elapsed_seconds=row.elapsed_seconds,
    )


# --- events --------------------------------------------------------------------------


async def propose(db: AsyncSession, player: Player, data: AccusationChoices) -> AccusationRow:
    """accusation:propose: a new proposal waiting for every player's vote."""
    game = await exploration.load_game(db, player)
    check_choices(game.case, data)
    accusation = AccusationRow(
        id=uuid.uuid4(),
        lobby_id=player.lobby_id,
        proposed_by=player.id,
        culprit=data.culprit,
        motive=data.motive,
        method=data.method,
        status=AccusationStatus.PENDING,
    )
    db.add(accusation)
    try:
        # The unique index allows one pending proposal per lobby.
        await db.flush()
    except IntegrityError:
        raise AccusationError("A proposal is already waiting for votes.") from None
    return accusation


async def vote(db: AsyncSession, player: Player, data: VoteAccusation) -> VoteOutcome:
    """accusation:vote: one rejection rejects the proposal; all accepting ends the game."""
    game = await exploration.load_game(db, player)
    try:
        accusation_id = uuid.UUID(data.proposal)
    except ValueError:
        raise AccusationError("This proposal is no longer open.") from None
    # Locked until commit, so votes on the same proposal are counted one after another.
    accusation = await db.scalar(
        select(AccusationRow)
        .where(AccusationRow.id == accusation_id, AccusationRow.lobby_id == player.lobby_id)
        .with_for_update()
    )
    if accusation is None or accusation.status != AccusationStatus.PENDING:
        raise AccusationError("This proposal is no longer open.")
    if await db.get(AccusationVote, (accusation.id, player.id)) is not None:
        raise AccusationError("You already voted.")
    db.add(AccusationVote(accusation_id=accusation.id, player_id=player.id, accept=data.accept))
    if not data.accept:
        accusation.status = AccusationStatus.REJECTED
        return VoteOutcome(accusation)
    await db.flush()

    accepted = set(
        await db.scalars(
            select(AccusationVote.player_id).where(
                AccusationVote.accusation_id == accusation.id, AccusationVote.accept.is_(True)
            )
        )
    )
    players = await db.scalars(select(Player.id).where(Player.lobby_id == player.lobby_id))
    if not everyone_accepted(list(players), accepted):
        return VoteOutcome(accusation)
    return VoteOutcome(accusation, await _end_game(db, game, accusation))


async def _end_game(
    db: AsyncSession, game: exploration.Game, accusation: AccusationRow
) -> GameResult:
    """Accept the proposal, score it, store the result and finish the lobby."""
    lobby, case = game.lobby, game.case
    now = datetime.now(UTC)
    assert lobby.started_at is not None, "a game in progress has a start time"
    elapsed_seconds = int((now - lobby.started_at).total_seconds())
    asked = await db.scalars(
        select(InterrogationEntry.suspect).where(InterrogationEntry.lobby_id == lobby.id)
    )
    chosen = AccusationChoices(
        culprit=accusation.culprit, motive=accusation.motive, method=accusation.method
    )
    breakdown = score(case, chosen, elapsed_seconds, unused_questions(case, list(asked)))

    accusation.status = AccusationStatus.ACCEPTED
    lobby.status = LobbyStatus.FINISHED
    lobby.ended_at = now
    db.add(
        GameResultRow(
            lobby_id=lobby.id,
            accusation_id=accusation.id,
            culprit_points=breakdown.culprit,
            motive_points=breakdown.motive,
            method_points=breakdown.method,
            time_bonus=breakdown.time_bonus,
            unused_questions_bonus=breakdown.unused_questions,
            total=breakdown.total,
            elapsed_seconds=breakdown.elapsed_seconds,
        )
    )
    return game_result(case, chosen, breakdown, await _found_clues(db, lobby.id))


async def load_result(db: AsyncSession, game: exploration.Game) -> GameResult | None:
    """The stored result of a game that has ended; None while it is in progress."""
    row = await db.get(GameResultRow, game.lobby.id)
    if row is None:
        return None
    accepted = await db.get(AccusationRow, row.accusation_id)
    assert accepted is not None, "a stored result points to its accusation"
    chosen = AccusationChoices(
        culprit=accepted.culprit, motive=accepted.motive, method=accepted.method
    )
    return game_result(game.case, chosen, stored_score(row), await _found_clues(db, game.lobby.id))


async def _found_clues(db: AsyncSession, lobby_id: uuid.UUID) -> set[str]:
    return set(await db.scalars(select(FoundClue.clue_id).where(FoundClue.lobby_id == lobby_id)))
