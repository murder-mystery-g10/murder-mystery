"""Interrogation rules and the interrogation:ask flow, without a database (CI has no Postgres).

The socket flow test replaces the database session, `interrogation.prepare` / `save` and the AI
client with fakes, so it checks the order of events and that a failed AI call saves nothing.
"""

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any, cast

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from backend import interrogation, sockets
from backend.ai_client import AIClient
from backend.interrogation import Evidence, InterrogationError
from backend.models import InterrogationEntry, Player
from shared_schemas.ai_api import Emotion, InterrogateRequest, InterrogateResponse
from shared_schemas.case import Case, Suspect
from shared_schemas.game_api import InterrogationAnswer

CASE_FILE = Path(__file__).parents[2] / "cases" / "vornicu_1926.json"


def _case() -> Case:
    return Case.model_validate(json.loads(CASE_FILE.read_text(encoding="utf-8")))


def _suspect(case: Case, suspect_id: str) -> Suspect:
    return interrogation.find_suspect(case, suspect_id)


def _entry(suspect: str, revealed: list[str] | None = None, **fields: Any) -> InterrogationEntry:
    values: dict[str, Any] = {
        "id": uuid.uuid4(),
        "suspect": suspect,
        "asked_by": uuid.uuid4(),
        "question": "Where were you at 21:30?",
        "evidence": None,
        "answer": "In the hall.",
        "emotion": Emotion.CALM,
        "intensity": 0.3,
        "revealed_testimonies": revealed or [],
    }
    return InterrogationEntry(**(values | fields))


# --- shared questions ------------------------------------------------------------------


def test_interrogation_event_is_registered() -> None:
    sio = sockets.create_socket_server(cors_origins=[])
    assert "interrogation:ask" in sio.handlers["/"]


def test_the_team_shares_six_questions_per_suspect() -> None:
    case = _case()
    assert case.questions_per_suspect == 6
    assert interrogation.questions_left(case, 0) == 6
    assert interrogation.questions_left(case, 5) == 1
    assert interrogation.questions_left(case, 6) == 0
    assert interrogation.questions_left(case, 8) == 0


def test_an_unknown_suspect_is_refused() -> None:
    with pytest.raises(InterrogationError, match="Unknown suspect"):
        interrogation.find_suspect(_case(), "butler")


# --- break stages ----------------------------------------------------------------------


def test_without_evidence_nobody_breaks() -> None:
    case = _case()
    for suspect in case.suspects:
        assert interrogation.reached_stage(suspect, [], 0) == 0


def test_any_one_combination_of_a_stage_is_enough() -> None:
    strat = _suspect(_case(), "strat")
    for shown in (["B1"], ["ana_doctor_hall"], ["victor_stairs"]):
        assert interrogation.reached_stage(strat, shown, 0) == 1


def test_a_combination_needs_all_its_evidence() -> None:
    victor = _suspect(_case(), "victor")
    assert interrogation.reached_stage(victor, ["B4"], 0) == 0
    assert interrogation.reached_stage(victor, ["B4", "H2"], 0) == 1


def test_stages_are_reached_in_order() -> None:
    strat = _suspect(_case(), "strat")
    # The confession evidence alone does not skip the first two stages.
    assert interrogation.reached_stage(strat, ["O1", "K5"], 0) == 0
    assert interrogation.reached_stage(strat, ["B1", "D1"], 0) == 2


def test_evidence_shown_earlier_lets_the_next_stages_follow() -> None:
    strat = _suspect(_case(), "strat")
    assert interrogation.reached_stage(strat, ["O1", "K5", "D1", "B1"], 0) == 3


def test_a_suspect_never_goes_back_or_past_the_last_stage() -> None:
    strat = _suspect(_case(), "strat")
    assert interrogation.reached_stage(strat, [], 2) == 2
    assert interrogation.reached_stage(strat, ["B1", "D1", "O1", "K5"], 3) == 3


def test_evidence_adds_up_across_questions() -> None:
    victor = _suspect(_case(), "victor")
    first, shown = interrogation.build_state(
        victor,
        stage_before=0,
        shown_before=[],
        evidence=interrogation.clue_evidence("B4"),
        asked=[],
    )
    assert (first.break_stage, first.just_broke, shown) == (0, False, ["B4"])

    second, shown = interrogation.build_state(
        victor,
        stage_before=0,
        shown_before=shown,
        evidence=interrogation.clue_evidence("H2"),
        asked=[],
    )
    assert (second.break_stage, second.just_broke, shown) == (1, True, ["B4", "H2"])


def test_a_suspect_breaks_only_once_per_stage() -> None:
    victor = _suspect(_case(), "victor")
    state, shown = interrogation.build_state(
        victor,
        stage_before=1,
        shown_before=["B4", "H2"],
        evidence=interrogation.clue_evidence("H2"),
        asked=[],
    )
    assert (state.break_stage, state.just_broke, shown) == (1, False, ["B4", "H2"])


def test_the_state_lists_testimonies_already_revealed() -> None:
    victor = _suspect(_case(), "victor")
    asked = [_entry("victor", ["victor_stairs"]), _entry("victor"), _entry("victor")]
    state, _ = interrogation.build_state(
        victor, stage_before=1, shown_before=[], evidence=None, asked=asked
    )
    assert state.revealed_testimonies == ["victor_stairs"]


# --- quotes as evidence ----------------------------------------------------------------


def test_a_quote_counts_as_the_testimony_it_revealed() -> None:
    quote = _entry("victor", ["victor_stairs"])
    evidence = interrogation.quote_evidence(quote)
    assert evidence == Evidence(ref=str(quote.id), ids=["victor_stairs"], ai_id="victor_stairs")

    strat = _suspect(_case(), "strat")
    state, _ = interrogation.build_state(
        strat, stage_before=0, shown_before=[], evidence=evidence, asked=[]
    )
    assert (state.break_stage, state.just_broke) == (1, True)


def test_a_quote_without_a_testimony_proves_nothing() -> None:
    evidence = interrogation.quote_evidence(_entry("victor"))
    assert (evidence.ids, evidence.ai_id) == ([], None)


def test_the_history_shows_the_ai_the_testimony_behind_a_quote() -> None:
    quote = _entry("victor", ["victor_stairs"])
    asked = [_entry("strat", evidence="B1"), _entry("strat", evidence=str(quote.id))]
    entries = {str(entry.id): entry for entry in [quote, *asked]}
    turns = interrogation.history(asked, entries)
    assert [turn.evidence for turn in turns] == ["B1", "victor_stairs"]
    assert turns[0].answer == asked[0].answer


# --- what players see ------------------------------------------------------------------


def test_an_answer_does_not_show_which_testimony_it_revealed() -> None:
    case = _case()
    entry = _entry("victor", ["victor_stairs"])
    sent = interrogation.entry_out(entry).model_dump_json()
    assert "victor_stairs" not in sent
    assert "revealed" not in sent
    stairs = next(t for t in _suspect(case, "victor").testimonies if t.id == "victor_stairs")
    assert stairs.fact not in sent


# --- interrogation:ask flow ------------------------------------------------------------


class FakeSession:
    """Stands in for AsyncSession: returns the player and counts commits."""

    commits = 0

    def __init__(self, *_: object, **__: object) -> None:
        pass

    async def __aenter__(self) -> "FakeSession":
        return self

    async def __aexit__(self, *_: object) -> None:
        pass

    async def get(self, model: type, key: object) -> object:
        return PLAYER if model is Player else None

    async def commit(self) -> None:
        FakeSession.commits += 1

    async def rollback(self) -> None:
        pass


PLAYER = Player(id=uuid.uuid4(), lobby_id=uuid.uuid4(), name="Ana", location="station")


class FakeAI:
    def __init__(self, fail: bool) -> None:
        self.fail = fail
        self.calls = 0

    async def interrogate(self, request: InterrogateRequest) -> InterrogateResponse:
        self.calls += 1
        if self.fail:
            raise httpx.ConnectError("AI service is down")
        return InterrogateResponse(
            answer="I was in my room.", emotion=Emotion.NERVOUS, intensity=0.6
        )


def _prepared() -> interrogation.Prepared:
    case = _case()
    state, _ = interrogation.build_state(
        _suspect(case, "victor"), stage_before=0, shown_before=[], evidence=None, asked=[]
    )
    request = InterrogateRequest(
        case=case, suspect_id="victor", question="Where were you?", state=state
    )
    return interrogation.Prepared(
        lobby_id=PLAYER.lobby_id,
        suspect="victor",
        question="Where were you?",
        evidence=None,
        break_stage=0,
        evidence_shown=[],
        limit=6,
        request=request,
    )


@pytest.fixture
def flow(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """An interrogation:ask handler wired to fakes; returns what it recorded."""
    recorded: dict[str, Any] = {"emits": [], "saved": 0}
    FakeSession.commits = 0

    async def prepare(*_: object) -> interrogation.Prepared:
        return _prepared()

    async def save(db, player, prepared, response) -> InterrogationAnswer:  # noqa: ANN001
        recorded["saved"] += 1
        entry = _entry(prepared.suspect, answer=response.answer, asked_by=player.id)
        return InterrogationAnswer(entry=interrogation.entry_out(entry), questions_left=5)

    monkeypatch.setattr(sockets, "AsyncSession", FakeSession)
    monkeypatch.setattr(interrogation, "prepare", prepare)
    monkeypatch.setattr(interrogation, "save", save)

    def build(ai: FakeAI) -> Any:
        sio = sockets.create_socket_server(
            [], get_engine=lambda: cast(AsyncEngine, None), get_ai_client=lambda: cast(AIClient, ai)
        )

        async def get_session(sid: str) -> dict[str, str]:
            return {"player_id": str(PLAYER.id), "lobby_id": str(PLAYER.lobby_id)}

        async def emit(event: str, data: object = None, **_: object) -> None:
            recorded["emits"].append(event)

        monkeypatch.setattr(sio, "get_session", get_session)
        monkeypatch.setattr(sio, "emit", emit)
        return sio.handlers["/"]["interrogation:ask"]

    recorded["build"] = build
    return recorded


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


ASK = {"suspect": "victor", "question": "Where were you at 21:30?"}


@pytest.mark.anyio
async def test_an_answer_is_saved_and_sent_to_the_whole_lobby(flow: dict[str, Any]) -> None:
    ai = FakeAI(fail=False)
    ack = await flow["build"](ai)("sid", ASK)
    assert ack == {"ok": True, "error": None}
    assert ai.calls == 1
    assert flow["saved"] == 1
    assert flow["emits"] == ["interrogation:thinking", "interrogation:answer"]


@pytest.mark.anyio
async def test_a_failed_ai_call_does_not_use_a_question(flow: dict[str, Any]) -> None:
    ai = FakeAI(fail=True)
    ack = await flow["build"](ai)("sid", ASK)
    assert ack["ok"] is False
    assert ack["error"] == interrogation.UNAVAILABLE
    # Nothing written: no entry, so the question is still there, and no evidence or break saved.
    assert flow["saved"] == 0
    assert FakeSession.commits == 1  # only the read-only prepare step
    assert flow["emits"] == ["interrogation:thinking", "interrogation:unavailable"]


@pytest.mark.anyio
async def test_a_refused_question_never_reaches_the_ai(
    flow: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    async def refuse(*_: object) -> None:
        raise InterrogationError("The team has no questions left for this suspect.")

    monkeypatch.setattr(interrogation, "prepare", refuse)
    ai = FakeAI(fail=False)
    ack = await flow["build"](ai)("sid", ASK)
    assert ack == {"ok": False, "error": "The team has no questions left for this suspect."}
    assert ai.calls == 0
    assert flow["emits"] == []


@pytest.mark.anyio
async def test_one_question_at_a_time_per_suspect(flow: dict[str, Any]) -> None:
    """Two players cannot both use the last question while the AI is answering."""
    release = asyncio.Event()

    class SlowAI(FakeAI):
        async def interrogate(self, request: InterrogateRequest) -> InterrogateResponse:
            await release.wait()
            return await super().interrogate(request)

    ask = flow["build"](SlowAI(fail=False))
    first = asyncio.create_task(ask("sid-1", ASK))
    await asyncio.sleep(0)  # the first question is now waiting for the AI
    second = await ask("sid-2", ASK)
    assert second == {"ok": False, "error": "The suspect is still answering another question."}
    other_suspect = asyncio.create_task(ask("sid-2", ASK | {"suspect": "elena"}))
    await asyncio.sleep(0)
    release.set()
    assert (await first)["ok"] is True
    assert (await other_suspect)["ok"] is True
    assert flow["saved"] == 2


@pytest.mark.anyio
async def test_invalid_data_is_refused(flow: dict[str, Any]) -> None:
    ai = FakeAI(fail=False)
    ack = await flow["build"](ai)("sid", {"suspect": "victor", "question": ""})
    assert ack == {"ok": False, "error": "Invalid data."}
    assert ai.calls == 0
