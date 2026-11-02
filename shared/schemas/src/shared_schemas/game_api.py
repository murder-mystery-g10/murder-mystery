"""Backend <-> frontend contract: REST bodies and Socket.IO event payloads.

Socket.IO rules:
- Event names are `domain:action`.
- Client -> server events are intents; the server checks them and answers with an ack.
- Server -> client events carry state; each player only receives what they may see.
- The client connects with `SocketAuth` as the `auth` option of the handshake.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from shared_schemas.ai_api import MAX_QUESTION_LENGTH, Emotion
from shared_schemas.base import Id, Schema
from shared_schemas.case import AccusationOption, Briefing, ClueIcon, Difficulty
from shared_schemas.health import HealthResponse, ReadinessResponse

PlayerName = Annotated[str, Field(min_length=1, max_length=24)]


# --- REST ---------------------------------------------------------------------------


class CreateLobbyRequest(Schema):
    player_name: PlayerName
    solo: bool = Field(default=False, description="Solo test mode: one player sees every room")


class JoinLobbyRequest(Schema):
    player_name: PlayerName


class LobbySession(Schema):
    lobby_code: str
    player_id: Id
    player_token: str = Field(description="Secret; sent as auth in the Socket.IO handshake")


class CaseSummary(Schema):
    case_id: Id
    title: str
    difficulty: Difficulty
    player_count: int
    summary: str


# --- Socket.IO: handshake, acks ---------------------------------------------------------


class SocketAuth(Schema):
    lobby_code: str
    player_token: str


class Ack(Schema):
    ok: bool
    error: str | None = Field(default=None, description="Shown to the player when ok is false")


class Ping(Schema):
    """Empty payload."""


class Pong(Schema):
    message: Literal["pong"]


# --- lobby --------------------------------------------------------------------------


class LobbyStatus(StrEnum):
    WAITING = "waiting"
    PLAYING = "playing"
    FINISHED = "finished"


class Player(Schema):
    id: Id
    name: str
    is_host: bool
    connected: bool
    location: Id | None = Field(default=None, description="Room id, 'station', or null")


class LobbyState(Schema):
    code: str
    status: LobbyStatus
    solo: bool
    players: list[Player]
    case: CaseSummary | None = None


class SelectCase(Schema):
    case_id: Id


class StartGame(Schema):
    """Empty payload. Host only; needs the case's player count, or solo mode."""


class PresenceUpdate(Schema):
    players: list[Player]


# --- exploration --------------------------------------------------------------------


class RoomAccess(Schema):
    room: Id
    yours: bool = Field(description="False: the door says another team handles this room")
    unlocked: bool
    lock: Literal["key", "code"] | None = None


class ClueCard(Schema):
    id: Id
    title: str
    icon: ClueIcon
    text: str
    room: Id
    found_by: Id


class EnterRoom(Schema):
    room: Id = Field(description="Room id, or 'station'")


class InspectObject(Schema):
    object: Id


class InspectAck(Ack):
    clues: list[ClueCard] = Field(default_factory=list, description="Empty: 'Nimic interesant'")


class UnlockRoom(Schema):
    room: Id
    key_clue: Id | None = Field(default=None, description="Key lock: a key from your notebook")
    code: str | None = Field(default=None, description="Code lock: the code")


class RoomUnlocked(Schema):
    room: Id
    by: Id


# --- board --------------------------------------------------------------------------


class BoardItemKind(StrEnum):
    CLUE = "clue"
    SUSPECT = "suspect"
    NOTE = "note"
    QUOTE = "quote"


class BoardItem(Schema):
    id: Id
    kind: BoardItemKind
    ref: Id | None = Field(default=None, description="Clue, suspect or interrogation entry id")
    text: str | None = Field(default=None, description="Note text")
    x: float
    y: float
    added_by: Id


class BoardLink(Schema):
    id: Id
    source: Id
    target: Id


class BoardState(Schema):
    items: list[BoardItem]
    links: list[BoardLink]


class BoardPin(Schema):
    kind: Literal["clue", "suspect", "quote"]
    ref: Id
    x: float
    y: float


class BoardAddNote(Schema):
    text: str = Field(min_length=1, max_length=500)
    x: float
    y: float


class BoardEditNote(Schema):
    item: Id
    text: str = Field(min_length=1, max_length=500)


class BoardMove(Schema):
    item: Id
    x: float
    y: float


class BoardConnect(Schema):
    source: Id
    target: Id


class BoardRemove(Schema):
    id: Id = Field(description="Item or link id")


# --- interrogation ------------------------------------------------------------------


class SuspectCard(Schema):
    id: Id
    name: str
    role: str
    archetype: Id
    initial_statement: str


class Ask(Schema):
    suspect: Id
    question: str = Field(min_length=1, max_length=MAX_QUESTION_LENGTH)
    evidence: Id | None = Field(default=None, description="Clue or quote id from the board")


class SuspectRef(Schema):
    suspect: Id


class InterrogationEntry(Schema):
    id: Id
    suspect: Id
    asked_by: Id
    question: str
    evidence: Id | None = None
    answer: str
    emotion: Emotion
    intensity: float = Field(ge=0, le=1)


class InterrogationAnswer(Schema):
    entry: InterrogationEntry
    questions_left: int


class SuspectUnavailable(Schema):
    suspect: Id
    message: str = Field(description="E.g. 'Suspectul refuză să vorbească momentan'")


class SuspectInterrogation(Schema):
    suspect: Id
    questions_left: int
    entries: list[InterrogationEntry]


# --- accusation, end ----------------------------------------------------------------


class AccusationChoices(Schema):
    culprit: Id
    motive: Id
    method: Id


class AccusationOptions(Schema):
    """The culprit is chosen among the suspects."""

    motive_options: list[AccusationOption]
    method_options: list[AccusationOption]


class AccusationProposal(Schema):
    id: Id
    proposed_by: Id
    choices: AccusationChoices
    votes: dict[Id, bool] = Field(description="Player id -> accepted; all must accept")


class AccusationState(Schema):
    proposal: AccusationProposal | None = Field(description="None after a rejection")


class VoteAccusation(Schema):
    proposal: Id
    accept: bool


class ScoreBreakdown(Schema):
    culprit: int
    motive: int
    method: int
    time_bonus: int
    unused_questions: int
    total: int
    elapsed_seconds: int


class MissedClue(Schema):
    id: Id
    title: str
    icon: ClueIcon
    text: str
    room: Id


class GameResult(Schema):
    chosen: AccusationChoices
    correct: AccusationChoices
    score: ScoreBreakdown
    reveal: str
    missed_clues: list[MissedClue]


# --- snapshot -----------------------------------------------------------------------


class GameSnapshot(Schema):
    """Everything one player may see. Sent at the start and on every (re)connect."""

    lobby: LobbyState
    you: Id
    theme: Id
    started_at: datetime
    briefing: Briefing
    rooms: list[RoomAccess]
    notebook: list[ClueCard]
    board: BoardState
    suspects: list[SuspectCard]
    interrogations: list[SuspectInterrogation]
    accusation_options: AccusationOptions
    accusation: AccusationProposal | None = None


# --- event registry -----------------------------------------------------------------


@dataclass(frozen=True)
class ClientEvent:
    payload: type[BaseModel]
    description: str
    ack: type[BaseModel] = Ack


@dataclass(frozen=True)
class ServerEvent:
    payload: type[BaseModel]
    description: str


CLIENT_EVENTS: dict[str, ClientEvent] = {
    "system:ping": ClientEvent(Ping, "Connectivity check", ack=Pong),
    "lobby:select_case": ClientEvent(SelectCase, "Host picks the case"),
    "lobby:start": ClientEvent(StartGame, "Host starts the game"),
    "room:enter": ClientEvent(EnterRoom, "Move to one of your rooms, or to the station"),
    "room:unlock": ClientEvent(UnlockRoom, "Use a key from your notebook or enter a code"),
    "object:inspect": ClientEvent(
        InspectObject, "Click an object; found clues go to your notebook", ack=InspectAck
    ),
    "board:pin": ClientEvent(BoardPin, "Pin a clue, suspect or quote (station only)"),
    "board:add_note": ClientEvent(BoardAddNote, "Add a free note"),
    "board:edit_note": ClientEvent(BoardEditNote, "Edit a note"),
    "board:move": ClientEvent(BoardMove, "Move an item"),
    "board:connect": ClientEvent(BoardConnect, "Link two items with a string"),
    "board:remove": ClientEvent(BoardRemove, "Remove an item or a link"),
    "interrogation:ask": ClientEvent(
        Ask, "Ask a suspect (station only); uses one of the team's questions"
    ),
    "accusation:propose": ClientEvent(AccusationChoices, "Propose the final accusation"),
    "accusation:vote": ClientEvent(VoteAccusation, "Accept or reject the proposal"),
}

SERVER_EVENTS: dict[str, ServerEvent] = {
    "lobby:state": ServerEvent(LobbyState, "Lobby changed; sent to everyone in it"),
    "game:snapshot": ServerEvent(GameSnapshot, "Full personal state, at start and on reconnect"),
    "presence:update": ServerEvent(PresenceUpdate, "Who is where (top bar)"),
    "room:unlocked": ServerEvent(RoomUnlocked, "A door opened for everyone with access"),
    "board:state": ServerEvent(BoardState, "The whole board, after every change"),
    "interrogation:thinking": ServerEvent(SuspectRef, "A suspect is answering; wait for them"),
    "interrogation:answer": ServerEvent(InterrogationAnswer, "A suspect answered"),
    "interrogation:unavailable": ServerEvent(
        SuspectUnavailable, "The AI did not answer; the question was not used"
    ),
    "accusation:state": ServerEvent(AccusationState, "Accusation proposed, voted or rejected"),
    "game:ended": ServerEvent(GameResult, "Score, correct answers, reveal and missed clues"),
}


def _collect_models() -> list[type[BaseModel]]:
    models: list[type[BaseModel]] = [
        HealthResponse,
        ReadinessResponse,
        CreateLobbyRequest,
        JoinLobbyRequest,
        LobbySession,
        CaseSummary,
        SocketAuth,
    ]
    for client_event in CLIENT_EVENTS.values():
        models += [client_event.payload, client_event.ack]
    for server_event in SERVER_EVENTS.values():
        models.append(server_event.payload)
    return list(dict.fromkeys(models))


MODELS = _collect_models()


def socket_events_manifest() -> dict[str, dict[str, dict[str, str]]]:
    return {
        "client_to_server": {
            name: {
                "payload": event.payload.__name__,
                "ack": event.ack.__name__,
                "description": event.description,
            }
            for name, event in CLIENT_EVENTS.items()
        },
        "server_to_client": {
            name: {"payload": event.payload.__name__, "description": event.description}
            for name, event in SERVER_EVENTS.items()
        },
    }


def socket_events_markdown() -> str:
    lines = [
        "# Socket.IO events",
        "",
        "Generated from `shared_schemas.game_api`; do not edit by hand.",
        "Payload types are defined in `game-api.schema.json`.",
        "",
        "## Client → server",
        "",
        "Every event is answered with an ack.",
        "",
        "| Event | Payload | Ack | Description |",
        "|---|---|---|---|",
    ]
    lines += [
        f"| `{name}` | `{e.payload.__name__}` | `{e.ack.__name__}` | {e.description} |"
        for name, e in CLIENT_EVENTS.items()
    ]
    lines += ["", "## Server → client", "", "| Event | Payload | Description |", "|---|---|---|"]
    lines += [
        f"| `{name}` | `{e.payload.__name__}` | {e.description} |"
        for name, e in SERVER_EVENTS.items()
    ]
    return "\n".join(lines) + "\n"
