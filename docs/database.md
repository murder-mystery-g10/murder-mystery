# Database

Postgres, through SQLAlchemy (async) and Alembic. The models are in
[backend/src/backend/models.py](../backend/src/backend/models.py); the migrations in
`backend/alembic/versions/`.

## Principle: the database is the source of truth

Every player action (opening a door, finding a clue, pinning on the board, asking a question,
voting) is written to the database right away. `game:snapshot` is built from the database, so a
reconnect or a backend restart loses nothing. Keep in memory only what belongs to a connection:
Socket.IO session ids and who is online (`Player.connected` in the contract).

Ids that come from a case or a theme map (rooms, objects, clues, suspects, testimonies, accusation
options) are stored as plain strings; the game engine checks them against the case. Ids the
backend creates (lobbies, players, board items, interrogation entries, accusations) are UUIDs, and
are sent to the frontend as strings.

## Tables

| Table | One row per | Notes |
|---|---|---|
| `cases` | case in the library | `data` is the full `Case` JSON, solution included. Loaded from `cases/*.json` at startup (#33); generated cases go here later. Never sent to the browser. |
| `lobbies` | game | `code` is what players type to join. `started_at` drives the time bonus. |
| `players` | player in a lobby | Name unique per lobby. Only the SHA-256 of the player token is stored. `slot` (J1–J4) is set at start and decides the player's rooms. `location` is a room id, `station`, or empty. |
| `unlocked_rooms` | locked room someone opened | Rooms open at the start come from the case, not from this table. |
| `found_clues` | clue in one player's notebook | Personal: two players sharing a room each find the clue themselves. |
| `board_items` | item on the shared board | `ref` is a clue, suspect or interrogation entry id; `text` is only for notes. |
| `board_links` | string between two items | Deleting an item deletes its strings. |
| `suspect_states` | suspect touched in a lobby | `break_stage` reached; `evidence_shown` adds up across questions (break triggers combine). Stages are reached in order; several can follow in one answer. Written only with an answer. |
| `interrogation_entries` | answered question | Questions left for a suspect = the case's `questions_per_suspect` minus its rows. A failed AI call writes no row, so it does not use up a question. `evidence` is a clue or quote pinned on the board; a quote counts as the testimonies in `revealed_testimonies`, which are never sent to players. One question at a time per suspect. |
| `accusations` | proposed accusation | Status `pending`, `rejected` or `accepted`; at most one `pending` per lobby (enforced by a unique index). |
| `accusation_votes` | player's vote on a proposal | Every player online must accept; the proposer accepts automatically. Offline players do not count, and when one leaves the votes are counted again. |
| `game_results` | finished game | Mirrors `ScoreBreakdown`. |

Every game table has `lobby_id` with `ON DELETE CASCADE`: deleting a lobby removes everything in
it. Enums are stored as text (`waiting`, `pending`, ...), so adding a value needs no migration of
the column type.

## Changing the schema

1. Edit `models.py`.
2. Generate the migration against your local database (it must be at the latest revision first):

   ```bash
   docker compose up -d postgres
   cd backend
   uv run alembic upgrade head
   uv run alembic revision --autogenerate -m "short description"
   ```

3. Read the generated file in `backend/alembic/versions/` and fix what autogenerate gets wrong
   (renames show up as drop + add; data changes are never generated).
4. Apply it and check that models and database match:

   ```bash
   uv run alembic upgrade head
   uv run alembic check
   cd ..
   ```

   `alembic check` must print "No new upgrade operations detected".
5. Commit the model change and the migration together.
