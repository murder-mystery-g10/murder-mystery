from pathlib import Path

import pytest

from shared_schemas import Case

CASES_DIR = Path(__file__).resolve().parents[2] / "cases"
CASE_FILES = sorted(CASES_DIR.glob("*.json"))


def test_library_is_not_empty() -> None:
    assert CASE_FILES, f"no cases found in {CASES_DIR}"


@pytest.mark.parametrize("path", CASE_FILES, ids=lambda path: path.name)
def test_case_file_matches_schema(path: Path) -> None:
    case = Case.model_validate_json(path.read_text(encoding="utf-8"))
    assert path.stem == case.case_id


def test_vornicu_case() -> None:
    case = Case.model_validate_json((CASES_DIR / "vornicu_1926.json").read_text(encoding="utf-8"))
    assert case.truth.culprit == "strat"
    assert len(case.suspects) == 4
    assert len(case.clues) == 25
