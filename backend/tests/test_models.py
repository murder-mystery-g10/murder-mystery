"""Checks on the ORM models that need no database."""

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from backend.models import Base

GAME_TABLES = {
    "lobbies",
    "players",
    "unlocked_rooms",
    "found_clues",
    "board_items",
    "board_links",
    "suspect_states",
    "interrogation_entries",
    "accusations",
    "accusation_votes",
    "game_results",
}


def test_expected_tables_exist() -> None:
    assert set(Base.metadata.tables) == GAME_TABLES | {"cases"}


def test_every_table_compiles_for_postgres() -> None:
    dialect = postgresql.dialect()
    for table in Base.metadata.sorted_tables:
        assert "CREATE TABLE" in str(CreateTable(table).compile(dialect=dialect))
        for index in table.indexes:
            assert "INDEX" in str(CreateIndex(index).compile(dialect=dialect))


def test_deleting_a_lobby_deletes_everything_in_it() -> None:
    for name in GAME_TABLES - {"lobbies", "accusation_votes"}:
        foreign_keys = Base.metadata.tables[name].c.lobby_id.foreign_keys
        assert [(fk.column.table.name, fk.ondelete) for fk in foreign_keys] == [
            ("lobbies", "CASCADE")
        ], name

    # Votes hang off an accusation, which hangs off the lobby.
    votes = Base.metadata.tables["accusation_votes"]
    assert {fk.ondelete for fk in votes.foreign_keys} == {"CASCADE"}


def test_player_references_cascade() -> None:
    for table in Base.metadata.tables.values():
        for fk in table.foreign_keys:
            if fk.column.table.name == "players":
                assert fk.ondelete == "CASCADE", f"{table.name}.{fk.parent.name}"


def test_enums_are_stored_as_their_values() -> None:
    status = Base.metadata.tables["lobbies"].c.status.type
    assert status.enums == ["waiting", "playing", "finished"]
    assert status.native_enum is False
