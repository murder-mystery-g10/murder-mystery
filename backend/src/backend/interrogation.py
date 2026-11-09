"""Interrogation: the team questions a suspect from the police station.

Rules (docs/database.md):
- The team shares `questions_per_suspect` questions per suspect. An answered question is one
  `interrogation_entries` row; a failed AI call writes nothing, so it uses no question.
- Evidence comes from the board: a pinned clue, or a pinned quote (an earlier answer), which
  counts as the testimonies that answer revealed.
- Evidence shown to a suspect adds up across questions (`suspect_states.evidence_shown`).
  Break stages are reached in order; once a stage is reached, the next ones follow in the same
  answer if their evidence was already shown.

A question runs in two database steps around the AI call: `prepare` checks the rules and builds
the request, `save` stores the answer. Nothing is written before the AI has answered.
"""

import uuid
from collections.abc import Collection, Iterable
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend import exploration
from backend.models import BoardItem, InterrogationEntry, Player, SuspectState
from shared_schemas import STATION
from shared_schemas.ai_api import (
    DialogueTurn,
    InterrogateRequest,
    InterrogateResponse,
    InterrogationState,
)
from shared_schemas.case import Case, Suspect
from shared_schemas.game_api import Ask, BoardItemKind, InterrogationAnswer
from shared_schemas.game_api import InterrogationEntry as InterrogationEntryOut

UNAVAILABLE = "The suspect refuses to speak for now. Your question was not used."


class InterrogationError(Exception):
    """An interrogation rule was broken. The message is shown to the player."""


@dataclass
class Evidence:
    """Evidence shown with a question.

    `ref` is what the player showed (a clue id or a quote's entry id) and is stored on the entry.
    `ids` are the clue and testimony ids it counts as for break triggers. `ai_id` is the one id
    the AI service is shown: the clue, or the testimony the quote revealed.
    """

    ref: str
    ids: list[str]
    ai_id: str | None


@dataclass
class Prepared:
    """A checked question, ready for the AI service; `save` stores it once answered."""

    lobby_id: uuid.UUID
    suspect: str
    question: str
    evidence: Evidence | None
    break_stage: int
    evidence_shown: list[str]
    limit: int
    request: InterrogateRequest


# --- rules ---------------------------------------------------------------------------


def questions_left(case: Case, asked: int) -> int:
    return max(case.questions_per_suspect - asked, 0)


def find_suspect(case: Case, suspect_id: str) -> Suspect:
    suspect = next((item for item in case.suspects if item.id == suspect_id), None)
    if suspect is None:
        raise InterrogationError("Unknown suspect.")
    return suspect


def reached_stage(suspect: Suspect, shown: Collection[str], current: int) -> int:
    """Highest break stage reached, in order, with the evidence shown so far.

    A stage is met when every id of one of its trigger combinations has been shown.
    """
    shown = set(shown)
    stage = current
    while stage < len(suspect.break_stages) and any(
        set(combination) <= shown for combination in suspect.break_stages[stage].triggers
    ):
        stage += 1
    return stage


def quote_evidence(entry: InterrogationEntry) -> Evidence:
    """A quote counts as the testimonies its answer revealed (at most one, in practice)."""
    revealed = list(entry.revealed_testimonies)
    return Evidence(ref=str(entry.id), ids=revealed, ai_id=revealed[0] if revealed else None)


def clue_evidence(clue_id: str) -> Evidence:
    return Evidence(ref=clue_id, ids=[clue_id], ai_id=clue_id)


def ai_evidence_id(evidence_ref: str | None, entries: dict[str, InterrogationEntry]) -> str | None:
    """The id the AI service sees for evidence stored on an earlier entry."""
    if evidence_ref is None:
        return None
    quoted = entries.get(evidence_ref)
    return quote_evidence(quoted).ai_id if quoted is not None else evidence_ref


def history(
    asked: Iterable[InterrogationEntry], entries: dict[str, InterrogationEntry]
) -> list[DialogueTurn]:
    """Earlier questions to one suspect, oldest first, as the AI service expects them."""
    return [
        DialogueTurn(
            question=entry.question,
            evidence=ai_evidence_id(entry.evidence, entries),
            answer=entry.answer,
        )
        for entry in asked
    ]


def entry_out(entry: InterrogationEntry) -> InterrogationEntryOut:
    """An answered question as every player sees it; revealed testimony ids stay hidden."""
    return InterrogationEntryOut(
        id=str(entry.id),
        suspect=entry.suspect,
        asked_by=str(entry.asked_by),
        question=entry.question,
        evidence=entry.evidence,
        answer=entry.answer,
        emotion=entry.emotion,
        intensity=entry.intensity,
    )


def build_state(
    suspect: Suspect,
    *,
    stage_before: int,
    shown_before: Collection[str],
    evidence: Evidence | None,
    asked: Iterable[InterrogationEntry],
) -> tuple[InterrogationState, list[str]]:
    """The state sent to the AI service, and the evidence shown once this question is saved."""
    shown = list(shown_before)
    for evidence_id in evidence.ids if evidence else []:
        if evidence_id not in shown:
            shown.append(evidence_id)
    stage = reached_stage(suspect, shown, stage_before)
    revealed: list[str] = []
    for entry in asked:
        revealed += [item for item in entry.revealed_testimonies if item not in revealed]
    state = InterrogationState(
        break_stage=stage, just_broke=stage > stage_before, revealed_testimonies=revealed
    )
    return state, shown


# --- database steps ------------------------------------------------------------------


async def _board_evidence(db: AsyncSession, lobby_id: uuid.UUID, ref: str) -> Evidence:
    pinned = await db.scalar(
        select(BoardItem.kind)
        .where(
            BoardItem.lobby_id == lobby_id,
            BoardItem.ref == ref,
            BoardItem.kind.in_([BoardItemKind.CLUE, BoardItemKind.QUOTE]),
        )
        .limit(1)
    )
    if pinned is None:
        raise InterrogationError("Show evidence that is pinned on the board.")
    if pinned == BoardItemKind.CLUE:
        return clue_evidence(ref)
    entry = await db.get(InterrogationEntry, uuid.UUID(ref))
    assert entry is not None and entry.lobby_id == lobby_id, "the board only pins this lobby's"
    return quote_evidence(entry)


async def _asked(db: AsyncSession, lobby_id: uuid.UUID, suspect: str) -> int:
    count = await db.scalar(
        select(func.count())
        .select_from(InterrogationEntry)
        .where(InterrogationEntry.lobby_id == lobby_id, InterrogationEntry.suspect == suspect)
    )
    return count or 0


async def prepare(db: AsyncSession, player: Player, data: Ask) -> Prepared:
    """interrogation:ask, before the AI call: check the rules and build the request."""
    game = await exploration.load_game(db, player)
    if player.location != STATION:
        raise InterrogationError("Suspects are questioned at the police station.")
    suspect = find_suspect(game.case, data.suspect)
    lobby_id = player.lobby_id

    entries = list(
        await db.scalars(
            select(InterrogationEntry)
            .where(InterrogationEntry.lobby_id == lobby_id)
            .order_by(InterrogationEntry.created_at)
        )
    )
    asked = [entry for entry in entries if entry.suspect == suspect.id]
    if questions_left(game.case, len(asked)) == 0:
        raise InterrogationError("The team has no questions left for this suspect.")

    evidence = await _board_evidence(db, lobby_id, data.evidence) if data.evidence else None
    state_row = await db.get(SuspectState, (lobby_id, suspect.id))
    state, shown = build_state(
        suspect,
        stage_before=state_row.break_stage if state_row else 0,
        shown_before=state_row.evidence_shown if state_row else [],
        evidence=evidence,
        asked=asked,
    )
    request = InterrogateRequest(
        case=game.case,
        suspect_id=suspect.id,
        question=data.question,
        evidence=evidence.ai_id if evidence else None,
        history=history(asked, {str(entry.id): entry for entry in entries}),
        state=state,
    )
    return Prepared(
        lobby_id=lobby_id,
        suspect=suspect.id,
        question=data.question,
        evidence=evidence,
        break_stage=state.break_stage,
        evidence_shown=shown,
        limit=game.case.questions_per_suspect,
        request=request,
    )


async def save(
    db: AsyncSession, player: Player, prepared: Prepared, response: InterrogateResponse
) -> InterrogationAnswer:
    """interrogation:ask, after the AI answered: store the answer and the suspect's state.

    The question count is checked again, in case the game moved on during the AI call.
    """
    await exploration.load_game(db, player)
    asked = await _asked(db, prepared.lobby_id, prepared.suspect)
    if asked >= prepared.limit:
        raise InterrogationError("The team has no questions left for this suspect.")

    state = await db.get(SuspectState, (prepared.lobby_id, prepared.suspect), with_for_update=True)
    if state is None:
        state = SuspectState(lobby_id=prepared.lobby_id, suspect=prepared.suspect)
        db.add(state)
    state.break_stage = max(state.break_stage or 0, prepared.break_stage)
    state.evidence_shown = prepared.evidence_shown

    entry = InterrogationEntry(
        id=uuid.uuid4(),
        lobby_id=prepared.lobby_id,
        suspect=prepared.suspect,
        asked_by=player.id,
        question=prepared.question,
        evidence=prepared.evidence.ref if prepared.evidence else None,
        answer=response.answer,
        emotion=response.emotion,
        intensity=response.intensity,
        revealed_testimonies=response.revealed_testimonies,
    )
    db.add(entry)
    return InterrogationAnswer(entry=entry_out(entry), questions_left=prepared.limit - asked - 1)
