import pytest
from pydantic import ValidationError

from shared_schemas import ThemeMap


def test_valid_map_parses(map_data: dict) -> None:
    theme_map = ThemeMap.model_validate(map_data)
    assert theme_map.object_rooms()["library.desk"] == "library"


def test_door_to_unknown_room_is_rejected(map_data: dict) -> None:
    map_data["rooms"][0]["doors"][0]["to"] = "attic"
    with pytest.raises(ValidationError, match="unknown target 'attic'"):
        ThemeMap.model_validate(map_data)


def test_door_to_the_station_is_rejected(map_data: dict) -> None:
    map_data["rooms"][0]["doors"][0]["to"] = "station"
    with pytest.raises(ValidationError, match="reached from the interface"):
        ThemeMap.model_validate(map_data)


def test_doors_are_optional(map_data: dict) -> None:
    del map_data["rooms"][1]["doors"]
    assert ThemeMap.model_validate(map_data).rooms[1].doors == []


def test_duplicate_object_id_is_rejected(map_data: dict) -> None:
    map_data["rooms"][1]["objects"][0]["id"] = "hall.coat_rack"
    with pytest.raises(ValidationError, match="duplicate object id"):
        ThemeMap.model_validate(map_data)


def test_zone_outside_the_image_is_rejected(map_data: dict) -> None:
    map_data["rooms"][0]["objects"][0]["zone"][0]["x"] = 150
    with pytest.raises(ValidationError):
        ThemeMap.model_validate(map_data)
