import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ai_service.config import Settings, get_settings
from ai_service.main import app
from ai_service.validation import build_validation_report
from shared_schemas.case import Case, ClueType, Pillar

ROOT = Path(__file__).parents[2]
CASE_DATA = json.loads((ROOT / "cases" / "vornicu_1926.json").read_text())
AUTH = {"X-Internal-Key": "test-key"}


@pytest.fixture
def case() -> Case:
    return Case.model_validate(CASE_DATA)


def _issue_rules(case: Case) -> set[str]:
    return {issue.rule for issue in build_validation_report(case).issues}


def test_vornicu_case_passes(case: Case) -> None:
    report = build_validation_report(case)

    assert report.valid is True
    assert report.issues == []


def test_validate_route_returns_report(case: Case) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(internal_api_key="test-key")
    try:
        response = TestClient(app).post(
            "/validate",
            json={"case": case.model_dump(mode="json")},
            headers=AUTH,
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"valid": True, "issues": []}


def test_clue_count_rule_detects_too_few_context_clues(case: Case) -> None:
    case.clues = [clue for clue in case.clues if clue.type != ClueType.CONTEXT]

    assert "clue_counts" in _issue_rules(case)


def test_rule_of_two_requires_two_rooms(case: Case) -> None:
    for index, clue in enumerate(case.clues):
        if clue.type == ClueType.CRITICAL and clue.pillar == Pillar.METHOD:
            clue.object = f"library.method_{index}"

    assert "rule_of_two" in _issue_rules(case)


def test_nobody_solves_alone_detects_player_with_all_rooms(case: Case) -> None:
    case.players[0].rooms = [room.room for room in case.rooms]

    assert "nobody_solves_alone" in _issue_rules(case)


def test_false_leads_need_refuting_clue_in_another_room(case: Case) -> None:
    for clue in case.clues:
        clue.refutes = []

    assert "false_leads_refuted" in _issue_rules(case)


def test_room_cannot_have_more_than_five_clues(case: Case) -> None:
    for index, clue in enumerate(case.clues[:6]):
        clue.object = f"library.overcrowded_{index}"

    assert "max_clues_per_room" in _issue_rules(case)
