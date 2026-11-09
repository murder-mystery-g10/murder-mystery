"""Accusation and score checks that need no database (CI has no Postgres)."""

import json
import uuid
from pathlib import Path

import pytest

from backend import accusation
from backend.models import GameResult as GameResultRow
from backend.sockets import create_socket_server
from shared_schemas.case import Case
from shared_schemas.game_api import AccusationChoices

CASE_FILE = Path(__file__).parents[2] / "cases" / "vornicu_1926.json"


def _case() -> Case:
    return Case.model_validate(json.loads(CASE_FILE.read_text(encoding="utf-8")))


def _wrong(case: Case) -> AccusationChoices:
    correct = accusation.correct_choices(case)
    return AccusationChoices(
        culprit=next(s.id for s in case.suspects if s.id != correct.culprit),
        motive=next(o.id for o in case.accusation.motive_options if o.id != correct.motive),
        method=next(o.id for o in case.accusation.method_options if o.id != correct.method),
    )


def test_accusation_events_are_registered() -> None:
    sio = create_socket_server(cors_origins=[])
    assert set(sio.handlers["/"]) >= {"accusation:propose", "accusation:vote"}


@pytest.mark.parametrize(
    ("minutes", "bonus"),
    [(0, 20), (34, 20), (35, 20), (45, 10), (55, 0), (60, -5), (75, -20), (120, -20)],
)
def test_time_bonus(minutes: int, bonus: int) -> None:
    assert accusation.time_bonus(minutes * 60) == bonus


def test_only_whole_minutes_count() -> None:
    assert accusation.time_bonus(45 * 60 + 59) == accusation.time_bonus(45 * 60)


def test_a_correct_accusation_scores_every_part() -> None:
    case = _case()
    score = accusation.score(case, accusation.correct_choices(case), 40 * 60, unused=3)
    assert (score.culprit, score.motive, score.method) == (50, 25, 25)
    assert score.time_bonus == 15
    assert score.unused_questions == 3
    assert score.total == 50 + 25 + 25 + 15 + 3
    assert score.elapsed_seconds == 40 * 60


def test_a_wrong_accusation_scores_only_the_bonuses() -> None:
    case = _case()
    score = accusation.score(case, _wrong(case), 60 * 60, unused=2)
    assert (score.culprit, score.motive, score.method) == (0, 0, 0)
    assert score.total == -5 + 2


def test_unused_questions_count_every_suspect() -> None:
    case = _case()
    first = case.suspects[0].id
    total = case.questions_per_suspect * len(case.suspects)
    assert accusation.unused_questions(case, []) == total
    assert accusation.unused_questions(case, [first, first]) == total - 2
    too_many = [first] * (case.questions_per_suspect + 2)
    assert accusation.unused_questions(case, too_many) == total - case.questions_per_suspect


def test_choices_must_come_from_the_case() -> None:
    case = _case()
    correct = accusation.correct_choices(case)
    accusation.check_choices(case, correct)
    for field, message in (("culprit", "suspect"), ("motive", "motive"), ("method", "method")):
        choices = correct.model_copy(update={field: "nope"})
        with pytest.raises(accusation.AccusationError, match=message):
            accusation.check_choices(case, choices)


def test_missed_clues_are_the_ones_nobody_found() -> None:
    case = _case()
    found = {clue.id for clue in case.clues[1:]}
    [missed] = accusation.missed_clues(case, found)
    assert missed.id == case.clues[0].id
    assert missed.text == case.clues[0].player_text
    assert missed.room == case.clues[0].object.split(".", 1)[0]


def test_the_result_has_the_answers_the_reveal_and_the_missed_clues() -> None:
    case = _case()
    chosen = _wrong(case)
    breakdown = accusation.score(case, chosen, 40 * 60, unused=1)
    found = {clue.id for clue in case.clues[1:]}
    result = accusation.game_result(case, chosen, breakdown, found)
    assert result.chosen == chosen
    assert result.correct == accusation.correct_choices(case)
    assert result.score == breakdown
    assert result.reveal == case.reveal
    assert [clue.id for clue in result.missed_clues] == [case.clues[0].id]


def test_a_stored_score_reads_back_unchanged() -> None:
    case = _case()
    breakdown = accusation.score(case, accusation.correct_choices(case), 50 * 60, unused=4)
    row = GameResultRow(
        lobby_id=uuid.uuid4(),
        accusation_id=uuid.uuid4(),
        culprit_points=breakdown.culprit,
        motive_points=breakdown.motive,
        method_points=breakdown.method,
        time_bonus=breakdown.time_bonus,
        unused_questions_bonus=breakdown.unused_questions,
        total=breakdown.total,
        elapsed_seconds=breakdown.elapsed_seconds,
    )
    assert accusation.stored_score(row) == breakdown
