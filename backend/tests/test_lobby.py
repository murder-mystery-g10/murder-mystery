"""Lobby, game start and snapshot checks that need no database (CI has no Postgres)."""

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest

from backend import accusation, lobby
from backend.models import Accusation as AccusationRow
from backend.models import AccusationVote, InterrogationEntry, Player
from backend.sockets import create_socket_server
from shared_schemas.ai_api import Emotion
from shared_schemas.case import Case
from shared_schemas.game_api import BoardState, GameSnapshot, LobbyState, LobbyStatus

CASE_FILE = Path(__file__).parents[2] / "cases" / "vornicu_1926.json"


def _case() -> Case:
    return Case.model_validate(json.loads(CASE_FILE.read_text(encoding="utf-8")))


def _players(count: int) -> list[Player]:
    return [Player(id=uuid.uuid4(), name=f"P{i}") for i in range(count)]


def _entry(suspect: str) -> InterrogationEntry:
    return InterrogationEntry(
        id=uuid.uuid4(),
        suspect=suspect,
        asked_by=uuid.uuid4(),
        question="Where were you at 22:00?",
        answer="In my room.",
        emotion=Emotion.CALM,
        intensity=0.2,
    )


def _snapshot(case: Case, **overrides: object) -> GameSnapshot:
    arguments: dict = {
        "case": case,
        "lobby": LobbyState(code="ABCD", status=LobbyStatus.PLAYING, solo=False, players=[]),
        "you": uuid.uuid4(),
        "started_at": datetime.now(UTC),
        "rooms": [],
        "found_clue_ids": [],
        "board_state": BoardState(items=[], links=[]),
        "entries": [],
        "accusation": None,
        "votes": [],
    }
    return lobby.build_snapshot(**(arguments | overrides))


def test_lobby_events_are_registered() -> None:
    sio = create_socket_server(cors_origins=[])
    assert set(sio.handlers["/"]) >= {"lobby:select_case", "lobby:start"}


def test_players_get_the_case_slots_in_join_order() -> None:
    assert lobby.assign_slots(_case(), _players(4), solo=False) == ["J1", "J2", "J3", "J4"]


@pytest.mark.parametrize("count", [3, 5])
def test_the_game_needs_the_case_player_count(count: int) -> None:
    with pytest.raises(lobby.LobbyError, match="needs 4 players"):
        lobby.assign_slots(_case(), _players(count), solo=False)


def test_solo_mode_skips_the_player_count_and_gives_no_slot() -> None:
    assert lobby.assign_slots(_case(), _players(1), solo=True) == [None]


def test_the_snapshot_never_contains_the_solution() -> None:
    case = _case()
    sent = _snapshot(case).model_dump_json()
    hidden = [
        case.truth.motive,
        case.truth.method,
        case.reveal,
        *(event.event for event in case.truth.timeline),
        *(suspect.secret for suspect in case.suspects if suspect.secret),
        *(clue.proves for clue in case.clues),
    ]
    for text in hidden:
        assert text not in sent
    for key in ("truth", "culprit", "secret", "lies_about", "correct_motive", "correct_method"):
        assert f'"{key}"' not in sent


def test_the_snapshot_has_the_public_case_data() -> None:
    case = _case()
    snapshot = _snapshot(case)
    assert snapshot.theme == case.theme
    assert snapshot.briefing == case.briefing
    assert [card.id for card in snapshot.suspects] == [suspect.id for suspect in case.suspects]
    assert len(snapshot.accusation_options.motive_options) == 4
    assert snapshot.accusation is None
    assert snapshot.result is None


def test_the_notebook_shows_found_clues_with_their_room() -> None:
    case = _case()
    you = uuid.uuid4()
    snapshot = _snapshot(case, you=you, found_clue_ids=["K1"])
    [card] = snapshot.notebook
    assert (card.id, card.room, card.found_by) == ("K1", "kitchen", str(you))


def test_questions_left_count_only_that_suspect() -> None:
    case = _case()
    first, second = case.suspects[0].id, case.suspects[1].id
    snapshot = _snapshot(case, entries=[_entry(first), _entry(first), _entry(second)])
    left = {item.suspect: item.questions_left for item in snapshot.interrogations}
    assert left[first] == case.questions_per_suspect - 2
    assert left[second] == case.questions_per_suspect - 1
    assert len(left) == len(case.suspects)


def test_a_pending_accusation_shows_its_votes() -> None:
    voter = uuid.uuid4()
    accusation = AccusationRow(
        id=uuid.uuid4(), proposed_by=voter, culprit="strat", motive="M1", method="X1"
    )
    votes = [AccusationVote(accusation_id=accusation.id, player_id=voter, accept=True)]
    snapshot = _snapshot(_case(), accusation=accusation, votes=votes)
    assert snapshot.accusation is not None
    assert snapshot.accusation.votes == {str(voter): True}


def test_after_the_end_the_snapshot_has_the_result() -> None:
    case = _case()
    chosen = accusation.correct_choices(case)
    breakdown = accusation.score(case, chosen, 30 * 60, unused=0)
    result = accusation.game_result(case, chosen, breakdown, found=set())
    assert _snapshot(case, result=result).result == result


# --- each player sees only what they may -------------------------------------------------


def test_each_player_snapshot_has_only_their_own_notebook() -> None:
    case = _case()
    ana, dan = uuid.uuid4(), uuid.uuid4()
    for_ana = _snapshot(case, you=ana, found_clue_ids=["K1"])
    for_dan = _snapshot(case, you=dan, found_clue_ids=["B1"])
    assert [card.id for card in for_ana.notebook] == ["K1"]
    assert [card.id for card in for_dan.notebook] == ["B1"]
    k1 = next(clue for clue in case.clues if clue.id == "K1")
    assert k1.player_text not in for_dan.model_dump_json()
    assert (for_ana.you, for_dan.you) == (str(ana), str(dan))


def test_the_snapshot_hides_how_suspects_break_and_how_doors_open() -> None:
    case = _case()
    sent = _snapshot(case).model_dump_json()
    for suspect in case.suspects:
        for lie in suspect.lies_about:
            assert lie not in sent
        for testimony in suspect.testimonies:
            assert testimony.fact not in sent
        for stage in suspect.break_stages:
            assert stage.admits not in sent
    assert "1919" not in sent  # the greenhouse code ("code" itself is the lobby code's key)
    for key in ("break_stages", "testimonies", "lies_about", "evidence_shown", "hint_clues"):
        assert f'"{key}"' not in sent


def test_every_player_sees_the_whole_team_dialogue() -> None:
    case = _case()
    entries = [_entry("victor"), _entry("strat")]
    for you in (uuid.uuid4(), uuid.uuid4()):
        snapshot = _snapshot(case, you=you, entries=entries)
        shown = [entry.id for item in snapshot.interrogations for entry in item.entries]
        assert sorted(shown) == sorted(str(entry.id) for entry in entries)
