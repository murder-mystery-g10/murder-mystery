"""Case library checks that need no database or AI service (CI has neither)."""

import logging
from pathlib import Path

import httpx
import pytest

from backend.library import load_library_in_background, read_cases, validated_cases
from shared_schemas.ai_api import Severity, ValidateRequest, ValidationIssue, ValidationReport

CASES_DIR = Path(__file__).parents[2] / "cases"


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class FakeAIClient:
    """Answers /validate without the AI service: cases whose id is in `rejected` fail."""

    def __init__(self, rejected: set[str] = frozenset(), reachable: bool = True) -> None:
        self.rejected = rejected
        self.reachable = reachable
        self.calls = 0

    async def validate(self, request: ValidateRequest) -> ValidationReport:
        self.calls += 1
        if not self.reachable:
            raise httpx.ConnectError("AI service is down")
        if request.case.case_id in self.rejected:
            issue = ValidationIssue(rule="rule_of_two", severity=Severity.ERROR, message="bad")
            return ValidationReport(valid=False, issues=[issue])
        return ValidationReport(valid=True)


def test_every_case_in_the_library_folder_is_read() -> None:
    cases = read_cases(CASES_DIR)
    assert len(cases) == len(list(CASES_DIR.glob("*.json")))
    assert "vornicu_1926" in {case.case_id for case in cases}


def test_a_broken_file_is_skipped(tmp_path: Path) -> None:
    (tmp_path / "good.json").write_bytes((CASES_DIR / "vornicu_1926.json").read_bytes())
    (tmp_path / "broken.json").write_text('{"title": "no case here"}', encoding="utf-8")
    (tmp_path / "notes.md").write_text("not a case", encoding="utf-8")
    assert [case.case_id for case in read_cases(tmp_path)] == ["vornicu_1926"]


@pytest.mark.anyio
async def test_only_cases_without_errors_are_kept() -> None:
    cases = read_cases(CASES_DIR)
    assert await validated_cases(cases, FakeAIClient()) == cases
    assert await validated_cases(cases, FakeAIClient(rejected={"vornicu_1926"})) == []


@pytest.mark.anyio
async def test_loading_gives_up_when_the_ai_service_stays_down(
    caplog: pytest.LogCaptureFixture,
) -> None:
    client = FakeAIClient(reachable=False)
    with caplog.at_level(logging.WARNING):
        await load_library_in_background(None, client, CASES_DIR, attempts=3, delay=0)
    assert client.calls == 3
    assert "gave up after 3 attempts" in caplog.text
