from collections.abc import Callable

import pytest
from pydantic import ValidationError

from shared_schemas import Case, ThemeMap, find_map_errors


def test_valid_case_parses(case_data: dict) -> None:
    case = Case.model_validate(case_data)
    assert case.truth.culprit == "c"
    assert len(case.suspects[0].break_stages) == 2


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda d: d["truth"].update(culprit="nobody"), "is not a suspect"),
        (lambda d: d["suspects"][1].update(secret=None), "need a secret"),
        (lambda d: d["clues"][0].update(pillar="means"), "pillar is required"),
        (
            lambda d: d["suspects"][0]["break_stages"][0].update(triggers=[["ghost"]]),
            "unknown id 'ghost'",
        ),
        (lambda d: d["suspects"][2]["break_stages"][0].update(unlocks=["t1"]), "unlocks"),
        (lambda d: d["truth"]["timeline"][0].update(witnessed_by=["c"]), "did not witness"),
        (lambda d: d.update(player_count=4), "player_count is 4"),
        (lambda d: d["accusation"].update(correct_motive="m9"), "correct motive"),
        (lambda d: d["clues"][1].update(id="key"), "duplicate clue id"),
    ],
)
def test_inconsistent_case_is_rejected(
    case_data: dict, mutate: Callable[[dict], None], message: str
) -> None:
    mutate(case_data)
    with pytest.raises(ValidationError, match=message):
        Case.model_validate(case_data)


def test_accusation_needs_four_options(case_data: dict) -> None:
    case_data["accusation"]["motive_options"].pop()
    with pytest.raises(ValidationError):
        Case.model_validate(case_data)


def test_case_matches_its_map(case_data: dict, map_data: dict) -> None:
    errors = find_map_errors(Case.model_validate(case_data), ThemeMap.model_validate(map_data))
    assert errors == []


def test_clue_on_missing_object_is_reported(case_data: dict, map_data: dict) -> None:
    case_data["clues"][0]["object"] = "hall.mirror"
    errors = find_map_errors(Case.model_validate(case_data), ThemeMap.model_validate(map_data))
    assert any("hall.mirror" in error for error in errors)
