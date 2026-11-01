# Socket.IO events

Generated from `shared_schemas.game_api`; do not edit by hand.
Payload types are defined in `game-api.schema.json`.

## Client → server

Every event is answered with an ack.

| Event | Payload | Ack | Description |
|---|---|---|---|
| `system:ping` | `Ping` | `Pong` | Connectivity check |
| `lobby:select_case` | `SelectCase` | `Ack` | Host picks the case |
| `lobby:start` | `StartGame` | `Ack` | Host starts the game |
| `room:enter` | `EnterRoom` | `Ack` | Move to one of your rooms, or to the station |
| `room:unlock` | `UnlockRoom` | `Ack` | Use a key from your notebook or enter a code |
| `object:inspect` | `InspectObject` | `InspectAck` | Click an object; found clues go to your notebook |
| `board:pin` | `BoardPin` | `Ack` | Pin a clue, suspect or quote (station only) |
| `board:add_note` | `BoardAddNote` | `Ack` | Add a free note |
| `board:edit_note` | `BoardEditNote` | `Ack` | Edit a note |
| `board:move` | `BoardMove` | `Ack` | Move an item |
| `board:connect` | `BoardConnect` | `Ack` | Link two items with a string |
| `board:remove` | `BoardRemove` | `Ack` | Remove an item or a link |
| `interrogation:ask` | `Ask` | `Ack` | Ask a suspect (station only); uses one of the team's questions |
| `accusation:propose` | `AccusationChoices` | `Ack` | Propose the final accusation |
| `accusation:vote` | `VoteAccusation` | `Ack` | Accept or reject the proposal |

## Server → client

| Event | Payload | Description |
|---|---|---|
| `lobby:state` | `LobbyState` | Lobby changed; sent to everyone in it |
| `game:snapshot` | `GameSnapshot` | Full personal state, at start and on reconnect |
| `presence:update` | `PresenceUpdate` | Who is where (top bar) |
| `room:unlocked` | `RoomUnlocked` | A door opened for everyone with access |
| `board:state` | `BoardState` | The whole board, after every change |
| `interrogation:thinking` | `SuspectRef` | A suspect is answering; wait for them |
| `interrogation:answer` | `InterrogationAnswer` | A suspect answered |
| `interrogation:unavailable` | `SuspectUnavailable` | The AI did not answer; the question was not used |
| `accusation:state` | `AccusationState` | Accusation proposed, voted or rejected |
| `game:ended` | `GameResult` | Score, correct answers, reveal and missed clues |
