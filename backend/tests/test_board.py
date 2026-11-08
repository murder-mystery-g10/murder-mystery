"""Board checks that need no database (CI has no Postgres)."""

import pytest

from backend import board
from backend.sockets import create_socket_server

BOARD_EVENTS = {
    "board:pin",
    "board:add_note",
    "board:edit_note",
    "board:move",
    "board:connect",
    "board:remove",
}


def test_board_events_are_registered() -> None:
    sio = create_socket_server(cors_origins=[])
    assert BOARD_EVENTS <= set(sio.handlers["/"])


def test_an_id_that_is_not_a_uuid_is_rejected() -> None:
    with pytest.raises(board.BoardError):
        board._parse_id("not-a-uuid")