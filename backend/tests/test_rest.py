"""REST checks that need no database (CI has no Postgres)."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.config import Settings
from backend.lobby_join import CODE_ALPHABET, CODE_LENGTH, new_code, normalize_code
from backend.main import create_app
from backend.themes import load_theme_map

ZONE = [{"x": 1, "y": 1}, {"x": 2, "y": 1}, {"x": 2, "y": 2}]
MAP = {
    "theme_id": "test",
    "name": "Test",
    "station_image": "station.webp",
    "rooms": [
        {
            "id": "hall",
            "name": "Hol",
            "image": "hall.webp",
            "objects": [{"id": "hall.mirror", "name": "Oglindă", "zone": ZONE}],
        }
    ],
}


@pytest.fixture
def themes_dir(tmp_path: Path) -> Path:
    (tmp_path / "test").mkdir()
    (tmp_path / "test" / "map.json").write_text(json.dumps(MAP), encoding="utf-8")
    (tmp_path / "no_map").mkdir()
    return tmp_path


def _client(themes_dir: Path) -> TestClient:
    settings = Settings(
        internal_api_key="test",
        database_url="postgresql+asyncpg://x:x@127.0.0.1:1/x",
        ai_service_url="http://127.0.0.1:1",
        themes_dir=themes_dir,
    )
    return TestClient(create_app(settings))


def test_lobby_codes_are_easy_to_read() -> None:
    code = new_code()
    assert len(code) == CODE_LENGTH
    assert set(code) <= set(CODE_ALPHABET)
    assert not {"0", "O", "1", "I"} & set(CODE_ALPHABET)


def test_typed_codes_ignore_spaces_and_case() -> None:
    assert normalize_code(" ab3k9z ") == "AB3K9Z"


def test_a_theme_map_is_read_from_its_folder(themes_dir: Path) -> None:
    theme_map = load_theme_map(themes_dir, "test")
    assert theme_map is not None
    assert theme_map.object_rooms() == {"hall.mirror": "hall"}


def test_a_missing_theme_or_map_gives_nothing(themes_dir: Path) -> None:
    assert load_theme_map(themes_dir, "unknown") is None
    assert load_theme_map(themes_dir, "no_map") is None


def test_a_theme_id_cannot_leave_the_themes_folder(themes_dir: Path) -> None:
    for theme_id in ("..", "../test", "test/..", "a.b", ""):
        assert load_theme_map(themes_dir, theme_id) is None


def test_a_broken_map_is_an_error(themes_dir: Path) -> None:
    (themes_dir / "test" / "map.json").write_text('{"rooms": []}', encoding="utf-8")
    with pytest.raises(ValidationError):
        load_theme_map(themes_dir, "test")


def test_the_map_endpoint(themes_dir: Path) -> None:
    with _client(themes_dir) as client:
        found = client.get("/api/themes/test/map")
        missing = client.get("/api/themes/no_map/map")
    assert found.status_code == 200
    assert found.json()["rooms"][0]["id"] == "hall"
    assert missing.status_code == 404


def test_a_blank_name_is_refused_before_touching_the_database(themes_dir: Path) -> None:
    with _client(themes_dir) as client:
        create = client.post("/api/lobbies", json={"player_name": "   "})
        join = client.post("/api/lobbies/ABCDEF/join", json={"player_name": "   "})
        too_long = client.post("/api/lobbies", json={"player_name": "x" * 25})
    assert create.status_code == 422
    assert create.json()["detail"] == "Enter a name."
    assert join.status_code == 422
    assert too_long.status_code == 422
