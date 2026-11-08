"""Exploration rules that need no database (CI has no Postgres)."""

import json
from pathlib import Path

from backend.exploration import Game, findable_clues, object_room, player_rooms
from backend.models import Lobby, Player
from backend.sockets import create_socket_server
from shared_schemas.case import Case

CASE_FILE = Path(__file__).parents[2] / "cases" / "vornicu_1926.json"


def _game(solo: bool = False) -> Game:
    case = Case.model_validate(json.loads(CASE_FILE.read_text(encoding="utf-8")))
    return Game(lobby=Lobby(solo=solo), case=case)


def _clue_ids(game: Game, slot: str | None, object_id: str) -> list[str]:
    return [clue.id for clue in findable_clues(game, Player(slot=slot), object_id)]


def test_exploration_events_are_registered() -> None:
    sio = create_socket_server(cors_origins=[])
    assert set(sio.handlers["/"]) >= {"room:enter", "object:inspect", "room:unlock"}


def test_a_player_handles_the_rooms_of_their_slot() -> None:
    game = _game()
    assert player_rooms(game, Player(slot="J1")) == {"hall", "library", "master_bedroom"}
    assert player_rooms(game, Player(slot=None)) == set()


def test_in_solo_mode_the_player_handles_every_room() -> None:
    game = _game(solo=True)
    assert player_rooms(game, Player(slot=None)) == {room.room for room in game.case.rooms}


def test_the_room_of_an_object_comes_from_its_id() -> None:
    assert object_room("kitchen.key_board") == "kitchen"


def test_a_key_clue_is_found_only_by_players_with_access_to_its_room() -> None:
    game = _game()
    # K2 (kitchen.key_board) opens the guest room: J4 has it, J2 does not.
    assert _clue_ids(game, "J4", "kitchen.key_board") == ["K2"]
    assert _clue_ids(game, "J2", "kitchen.key_board") == []


def test_other_clues_are_found_by_anyone_in_the_room() -> None:
    game = _game()
    assert _clue_ids(game, "J2", "kitchen.tea_tray") == ["K1"]
    assert _clue_ids(game, "J4", "kitchen.tea_tray") == ["K1"]


def test_an_object_without_clues_holds_nothing() -> None:
    assert _clue_ids(_game(), "J2", "kitchen.sink") == []
