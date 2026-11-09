"""Exploration rules that need no database (CI has no Postgres)."""

import json
import uuid
from pathlib import Path

import pytest

from backend.exploration import (
    ExplorationError,
    Game,
    check_can_enter,
    check_in_progress,
    check_unlock,
    findable_clues,
    object_room,
    object_text,
    player_rooms,
    players_with_access,
    rooms_out,
)
from backend.models import Lobby, Player
from backend.sockets import create_socket_server
from shared_schemas import STATION
from shared_schemas.case import Case
from shared_schemas.game_api import LobbyStatus, UnlockRoom

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


def test_an_object_without_clues_has_its_text_from_the_case() -> None:
    case = _game().case
    assert object_text(case, "kitchen.sink") is not None
    assert object_text(case, "kitchen.tea_tray") is None
    assert object_text(case, "kitchen.nowhere") is None


# --- room access per player -------------------------------------------------------------

OPEN_AT_START = {"hall", "library", "kitchen"}


def test_a_player_enters_only_their_own_open_rooms() -> None:
    game = _game()
    j1 = Player(slot="J1")
    check_can_enter(game, j1, "hall", OPEN_AT_START)
    with pytest.raises(ExplorationError, match="Another team"):
        check_can_enter(game, j1, "kitchen", OPEN_AT_START)
    with pytest.raises(ExplorationError, match="locked"):
        check_can_enter(game, j1, "master_bedroom", OPEN_AT_START)
    check_can_enter(game, j1, "master_bedroom", OPEN_AT_START | {"master_bedroom"})


def test_everyone_can_go_to_the_station() -> None:
    for slot in ("J1", "J2", "J3", "J4"):
        check_can_enter(_game(), Player(slot=slot), STATION, OPEN_AT_START)


def test_the_snapshot_marks_only_the_player_rooms_as_theirs() -> None:
    rooms = rooms_out(_game(), Player(slot="J2"), OPEN_AT_START)
    assert {room.room for room in rooms if room.yours} == {"library", "kitchen", "greenhouse"}
    by_room = {room.room: room for room in rooms}
    assert (by_room["greenhouse"].unlocked, by_room["greenhouse"].lock) == (False, "code")
    assert (by_room["kitchen"].unlocked, by_room["kitchen"].lock) == (True, None)


def test_room_access_never_contains_codes_or_keys() -> None:
    sent = json.dumps([room.model_dump() for room in rooms_out(_game(), Player(slot="J2"), set())])
    assert "1919" not in sent
    assert "key_clue" not in sent


# --- keys and codes ----------------------------------------------------------------------


def _unlock(
    slot: str,
    notebook: set[str] | None = None,
    unlocked: set[str] = OPEN_AT_START,
    *,
    room: str,
    key_clue: str | None = None,
    code: str | None = None,
) -> None:
    """J1-J4 tries room:unlock; `notebook` is the clue ids they found."""
    data = UnlockRoom(room=room, key_clue=key_clue, code=code)
    check_unlock(_game(), Player(slot=slot), data, unlocked, notebook or set())


def test_the_right_key_from_the_notebook_opens_the_door() -> None:
    _unlock("J1", {"B5"}, room="master_bedroom", key_clue="B5")


def test_a_key_must_be_in_the_player_notebook() -> None:
    with pytest.raises(ExplorationError, match="not in your notebook"):
        _unlock("J1", set(), room="master_bedroom", key_clue="B5")
    with pytest.raises(ExplorationError, match="Use a key"):
        _unlock("J1", {"B5"}, room="master_bedroom")


def test_a_key_for_another_door_does_not_fit() -> None:
    with pytest.raises(ExplorationError, match="does not fit"):
        _unlock("J4", {"K2"}, room="master_bedroom", key_clue="K2")


@pytest.mark.parametrize("code", ["1919", " 1919 "])
def test_the_right_code_opens_the_door(code: str) -> None:
    _unlock("J2", room="greenhouse", code=code)


@pytest.mark.parametrize("code", ["1920", "", None])
def test_a_wrong_code_is_refused(code: str | None) -> None:
    with pytest.raises(ExplorationError, match="Wrong code"):
        _unlock("J2", room="greenhouse", code=code)


def test_only_players_with_the_room_can_unlock_it() -> None:
    with pytest.raises(ExplorationError, match="Another team"):
        _unlock("J1", room="greenhouse", code="1919")


def test_an_open_door_cannot_be_unlocked() -> None:
    with pytest.raises(ExplorationError, match="not locked"):
        _unlock("J1", room="hall", code="1919")
    with pytest.raises(ExplorationError, match="already open"):
        _unlock("J2", unlocked=OPEN_AT_START | {"greenhouse"}, room="greenhouse", code="1919")


def test_an_unlocked_room_opens_for_everyone_with_access() -> None:
    game = _game()
    players = [Player(id=uuid.uuid4(), slot=slot) for slot in ("J1", "J2", "J3", "J4")]
    j1, j2, j3, j4 = (player.id for player in players)
    # J2 opens the greenhouse; J3 shares it and gets room:unlocked too, J1 and J4 do not.
    assert players_with_access(game, players, "greenhouse") == [j2, j3]
    assert players_with_access(game, players, "master_bedroom") == [j1, j4]


def test_in_solo_mode_the_player_unlocks_every_room() -> None:
    game = _game(solo=True)
    solo = Player(id=uuid.uuid4(), slot=None)
    check_unlock(game, solo, UnlockRoom(room="greenhouse", code="1919"), OPEN_AT_START, set())
    assert players_with_access(game, [solo], "greenhouse") == [solo.id]


# --- game in progress --------------------------------------------------------------------


def test_game_events_need_a_game_in_progress() -> None:
    check_in_progress(Lobby(status=LobbyStatus.PLAYING, case_id="vornicu_1926"))
    for lobby in (None, Lobby(status=LobbyStatus.WAITING, case_id="vornicu_1926")):
        with pytest.raises(ExplorationError, match="not in progress"):
            check_in_progress(lobby)


def test_after_the_end_only_the_snapshot_reads_the_game() -> None:
    finished = Lobby(status=LobbyStatus.FINISHED, case_id="vornicu_1926")
    check_in_progress(finished, finished=True)
    with pytest.raises(ExplorationError, match="not in progress"):
        check_in_progress(finished)
