"""ORM models: the database is the source of truth for every game.

Every player action is written here right away, and `game:snapshot` is built from these tables,
so a reconnect or a server restart loses nothing. Only connection details (Socket.IO session ids,
who is online) live in memory.

Ids that come from a case or a theme map (rooms, objects, clues, suspects, testimonies, accusation
options) are plain strings, checked against the case by the game engine. Ids the backend creates
(lobbies, players, board items, ...) are UUIDs.

Overview and rules: docs/database.md.
"""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.db import Base
from shared_schemas.ai_api import MAX_QUESTION_LENGTH, Emotion
from shared_schemas.case import Difficulty
from shared_schemas.game_api import BoardItemKind, LobbyStatus

# Length of a case or map id; matches `shared_schemas.base.Id`.
ID_LENGTH = 64


class CaseSource(StrEnum):
    LIBRARY = "library"
    GENERATED = "generated"


class AccusationStatus(StrEnum):
    PENDING = "pending"
    REJECTED = "rejected"
    ACCEPTED = "accepted"


def _enum(enum: type[StrEnum]) -> Enum:
    """Store the enum's values as plain text, so adding a value needs no type migration."""
    return Enum(
        enum,
        native_enum=False,
        length=16,
        values_callable=lambda members: [member.value for member in members],
    )


def _created_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


def _lobby_fk() -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey("lobbies.id", ondelete="CASCADE"), index=True)


def _player_fk() -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey("players.id", ondelete="CASCADE"))


def _id_list() -> Mapped[list[str]]:
    return mapped_column(ARRAY(String(ID_LENGTH)), server_default=text("'{}'"))


# --- library --------------------------------------------------------------------------


class CaseRecord(Base):
    """A playable case. `data` is the full `shared_schemas.Case`, including the solution."""

    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    theme: Mapped[str] = mapped_column(String(ID_LENGTH))
    difficulty: Mapped[Difficulty] = mapped_column(_enum(Difficulty))
    player_count: Mapped[int] = mapped_column(Integer)
    source: Mapped[CaseSource] = mapped_column(_enum(CaseSource))
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = _created_at()


# --- lobby and players ----------------------------------------------------------------


class Lobby(Base):
    __tablename__ = "lobbies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(8), unique=True)
    status: Mapped[LobbyStatus] = mapped_column(_enum(LobbyStatus), default=LobbyStatus.WAITING)
    solo: Mapped[bool] = mapped_column(Boolean, default=False)
    case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id"))
    created_at: Mapped[datetime] = _created_at()
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (UniqueConstraint("lobby_id", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lobby_id: Mapped[uuid.UUID] = _lobby_fk()
    name: Mapped[str] = mapped_column(String(24))
    is_host: Mapped[bool] = mapped_column(Boolean, default=False)
    # SHA-256 of the player token; the token itself is only ever sent to that player.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # The case's player slot (J1-J4), set when the game starts; decides which rooms they see.
    slot: Mapped[str | None] = mapped_column(String(ID_LENGTH))
    # Room id, "station", or None before the game starts.
    location: Mapped[str | None] = mapped_column(String(ID_LENGTH))
    joined_at: Mapped[datetime] = _created_at()


# --- exploration ----------------------------------------------------------------------


class UnlockedRoom(Base):
    """A locked room someone opened. Rooms open at the start come from the case."""

    __tablename__ = "unlocked_rooms"

    lobby_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lobbies.id", ondelete="CASCADE"), primary_key=True
    )
    room: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    unlocked_by: Mapped[uuid.UUID] = _player_fk()
    unlocked_at: Mapped[datetime] = _created_at()


class FoundClue(Base):
    """A clue in a player's notebook. Two players sharing a room each find it for themselves."""

    __tablename__ = "found_clues"

    lobby_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lobbies.id", ondelete="CASCADE"), primary_key=True
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), primary_key=True
    )
    clue_id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    found_at: Mapped[datetime] = _created_at()


# --- board ----------------------------------------------------------------------------


class BoardItem(Base):
    __tablename__ = "board_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lobby_id: Mapped[uuid.UUID] = _lobby_fk()
    kind: Mapped[BoardItemKind] = mapped_column(_enum(BoardItemKind))
    # Clue id, suspect id or interrogation entry id; None for notes.
    ref: Mapped[str | None] = mapped_column(String(ID_LENGTH))
    # Note text; None for the other kinds.
    text: Mapped[str | None] = mapped_column(String(500))
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    added_by: Mapped[uuid.UUID] = _player_fk()
    created_at: Mapped[datetime] = _created_at()


class BoardLink(Base):
    """A string between two board items; removing an item removes its strings."""

    __tablename__ = "board_links"
    __table_args__ = (UniqueConstraint("source_id", "target_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lobby_id: Mapped[uuid.UUID] = _lobby_fk()
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("board_items.id", ondelete="CASCADE"))
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("board_items.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = _created_at()


# --- interrogation --------------------------------------------------------------------


class SuspectState(Base):
    """How far a suspect has broken. Break triggers add up across questions."""

    __tablename__ = "suspect_states"

    lobby_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lobbies.id", ondelete="CASCADE"), primary_key=True
    )
    suspect: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    break_stage: Mapped[int] = mapped_column(Integer, default=0)
    # Clue and testimony ids shown to this suspect so far.
    evidence_shown: Mapped[list[str]] = _id_list()


class InterrogationEntry(Base):
    """One answered question. Questions left = the case's questions_per_suspect - rows.

    A failed AI call writes no row, so it does not use up a question.
    """

    __tablename__ = "interrogation_entries"
    __table_args__ = (
        Index("ix_interrogation_entries_lobby_suspect", "lobby_id", "suspect", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lobby_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lobbies.id", ondelete="CASCADE"))
    suspect: Mapped[str] = mapped_column(String(ID_LENGTH))
    asked_by: Mapped[uuid.UUID] = _player_fk()
    question: Mapped[str] = mapped_column(String(MAX_QUESTION_LENGTH))
    evidence: Mapped[str | None] = mapped_column(String(ID_LENGTH))
    answer: Mapped[str] = mapped_column(String(2000))
    emotion: Mapped[Emotion] = mapped_column(_enum(Emotion))
    intensity: Mapped[float] = mapped_column(Float)
    revealed_testimonies: Mapped[list[str]] = _id_list()
    created_at: Mapped[datetime] = _created_at()


# --- accusation and result ------------------------------------------------------------


class Accusation(Base):
    __tablename__ = "accusations"
    __table_args__ = (
        # At most one proposal waiting for votes in a lobby.
        Index(
            "uq_accusations_one_pending_per_lobby",
            "lobby_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lobby_id: Mapped[uuid.UUID] = _lobby_fk()
    proposed_by: Mapped[uuid.UUID] = _player_fk()
    culprit: Mapped[str] = mapped_column(String(ID_LENGTH))
    motive: Mapped[str] = mapped_column(String(ID_LENGTH))
    method: Mapped[str] = mapped_column(String(ID_LENGTH))
    status: Mapped[AccusationStatus] = mapped_column(
        _enum(AccusationStatus), default=AccusationStatus.PENDING
    )
    created_at: Mapped[datetime] = _created_at()


class AccusationVote(Base):
    __tablename__ = "accusation_votes"

    accusation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accusations.id", ondelete="CASCADE"), primary_key=True
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), primary_key=True
    )
    accept: Mapped[bool] = mapped_column(Boolean)
    voted_at: Mapped[datetime] = _created_at()


class GameResult(Base):
    """The final score; mirrors `shared_schemas.game_api.ScoreBreakdown`."""

    __tablename__ = "game_results"

    lobby_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lobbies.id", ondelete="CASCADE"), primary_key=True
    )
    accusation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accusations.id", ondelete="CASCADE")
    )
    culprit_points: Mapped[int] = mapped_column(Integer)
    motive_points: Mapped[int] = mapped_column(Integer)
    method_points: Mapped[int] = mapped_column(Integer)
    time_bonus: Mapped[int] = mapped_column(Integer)
    unused_questions_bonus: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    elapsed_seconds: Mapped[int] = mapped_column(Integer)
    finished_at: Mapped[datetime] = _created_at()


__all__ = [
    "Accusation",
    "AccusationStatus",
    "AccusationVote",
    "Base",
    "BoardItem",
    "BoardLink",
    "CaseRecord",
    "CaseSource",
    "FoundClue",
    "GameResult",
    "InterrogationEntry",
    "Lobby",
    "Player",
    "SuspectState",
    "UnlockedRoom",
]
