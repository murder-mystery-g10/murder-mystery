/* eslint-disable */
/** Generated from docs/contracts by scripts/gen-contracts.mjs. Do not edit by hand. */

export type Culprit = string
export type Motive = string
export type Method = string
export type Id = string
export type Text = string
export type MotiveOptions = AccusationOption[]
export type MethodOptions = AccusationOption[]
export type Id1 = string
export type ProposedBy = string
export type Ok = boolean
/**
 * Shown to the player when ok is false
 */
export type Error = string | null
export type Suspect = string
export type Question = string
/**
 * Clue or quote id from the board
 */
export type Evidence = string | null
export type Text1 = string
export type X = number
export type Y = number
export type Source = string
export type Target = string
export type Item = string
export type Text2 = string
export type Id2 = string
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardItemKind".
 */
export type BoardItemKind = 'clue' | 'suspect' | 'note' | 'quote'
/**
 * Clue, suspect or interrogation entry id
 */
export type Ref = string | null
/**
 * Note text
 */
export type Text3 = string | null
export type X1 = number
export type Y1 = number
export type AddedBy = string
export type Id3 = string
export type Source1 = string
export type Target1 = string
export type Item1 = string
export type X2 = number
export type Y2 = number
export type Kind = 'clue' | 'suspect' | 'quote'
export type Ref1 = string
export type X3 = number
export type Y3 = number
/**
 * Item or link id
 */
export type Id4 = string
export type Items = BoardItem[]
export type Links = BoardLink[]
export type When = string
export type Where = string
export type Name = string
export type Age = number | null
export type Description = string
export type Summary = string
export type Discovery = string
export type CoronerReport = string[]
export type Text4 = string
export type PointsToRoom = string
export type StoryHooks = StoryHook[]
export type CaseId = string
export type Title = string
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "Difficulty".
 */
export type Difficulty = 'easy' | 'normal' | 'hard'
export type PlayerCount = number
export type Summary1 = string
export type Id5 = string
export type Title1 = string
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "ClueIcon".
 */
export type ClueIcon = 'letter' | 'document' | 'bottle' | 'key' | 'photo' | 'item'
export type Text5 = string
export type Room = string
export type FoundBy = string
export type PlayerName = string
/**
 * Solo test mode: one player sees every room
 */
export type Solo = boolean
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "Emotion".
 */
export type Emotion = 'calm' | 'nervous' | 'angry' | 'sad' | 'arrogant' | 'broken'
/**
 * Room id, or 'station'
 */
export type Room1 = string
export type Culprit1 = number
export type Motive1 = number
export type Method1 = number
export type TimeBonus = number
export type UnusedQuestions = number
export type Total = number
export type ElapsedSeconds = number
export type Reveal = string
export type Id6 = string
export type Title2 = string
export type Text6 = string
export type Room2 = string
export type MissedClues = MissedClue[]
export type Code = string
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "LobbyStatus".
 */
export type LobbyStatus = 'waiting' | 'playing' | 'finished'
export type Solo1 = boolean
export type Id7 = string
export type Name1 = string
export type IsHost = boolean
export type Connected = boolean
/**
 * Room id, 'station', or null
 */
export type Location = string | null
export type Players = Player[]
export type You = string
export type Theme = string
export type StartedAt = string
export type Room3 = string
/**
 * False: the door says another team handles this room
 */
export type Yours = boolean
export type Unlocked = boolean
export type Lock = ('key' | 'code') | null
export type Rooms = RoomAccess[]
export type Notebook = ClueCard[]
export type Id8 = string
export type Name2 = string
export type Role = string
export type Archetype = string
export type InitialStatement = string
export type Suspects = SuspectCard[]
export type Suspect1 = string
export type QuestionsLeft = number
export type Id9 = string
export type Suspect2 = string
export type AskedBy = string
export type Question1 = string
export type Evidence1 = string | null
export type Answer = string
export type Intensity = number
export type Entries = InterrogationEntry[]
export type Interrogations = SuspectInterrogation[]
export type Status = 'ok'
export type Service = string
export type Version = string
export type Ok1 = boolean
/**
 * Shown to the player when ok is false
 */
export type Error1 = string | null
/**
 * Empty: 'Nimic interesant'
 */
export type Clues = ClueCard[]
export type Object = string
export type QuestionsLeft1 = number
export type PlayerName1 = string
export type LobbyCode = string
export type PlayerId = string
/**
 * Secret; sent as auth in the Socket.IO handshake
 */
export type PlayerToken = string
export type Message = 'pong'
export type Players1 = Player[]
export type Database = boolean
export type AiService = boolean
export type Room4 = string
export type By = string
export type CaseId1 = string
export type LobbyCode1 = string
export type PlayerToken1 = string
export type Suspect3 = string
export type Suspect4 = string
/**
 * E.g. 'The suspect refuses to speak for now'
 */
export type Message1 = string
export type Room5 = string
/**
 * Key lock: a key from your notebook
 */
export type KeyClue = string | null
/**
 * Code lock: the code
 */
export type Code1 = string | null
export type Proposal = string
export type Accept = boolean

export interface GameApi {
  [k: string]: unknown
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "AccusationChoices".
 */
export interface AccusationChoices {
  culprit: Culprit
  motive: Motive
  method: Method
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "AccusationOption".
 */
export interface AccusationOption {
  id: Id
  text: Text
}
/**
 * The culprit is chosen among the suspects.
 *
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "AccusationOptions".
 */
export interface AccusationOptions {
  motive_options: MotiveOptions
  method_options: MethodOptions
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "AccusationProposal".
 */
export interface AccusationProposal {
  id: Id1
  proposed_by: ProposedBy
  choices: AccusationChoices
  votes: Votes
}
/**
 * Player id -> accepted; all must accept
 */
export interface Votes {
  /**
   * This interface was referenced by `Votes`'s JSON-Schema definition
   * via the `patternProperty` "^[A-Za-z0-9_.-]+$".
   */
  [k: string]: boolean
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "AccusationState".
 */
export interface AccusationState {
  /**
   * None after a rejection
   */
  proposal: AccusationProposal | null
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "Ack".
 */
export interface Ack {
  ok: Ok
  error?: Error
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "Ask".
 */
export interface Ask {
  suspect: Suspect
  question: Question
  evidence?: Evidence
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardAddNote".
 */
export interface BoardAddNote {
  text: Text1
  x: X
  y: Y
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardConnect".
 */
export interface BoardConnect {
  source: Source
  target: Target
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardEditNote".
 */
export interface BoardEditNote {
  item: Item
  text: Text2
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardItem".
 */
export interface BoardItem {
  id: Id2
  kind: BoardItemKind
  ref?: Ref
  text?: Text3
  x: X1
  y: Y1
  added_by: AddedBy
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardLink".
 */
export interface BoardLink {
  id: Id3
  source: Source1
  target: Target1
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardMove".
 */
export interface BoardMove {
  item: Item1
  x: X2
  y: Y2
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardPin".
 */
export interface BoardPin {
  kind: Kind
  ref: Ref1
  x: X3
  y: Y3
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardRemove".
 */
export interface BoardRemove {
  id: Id4
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "BoardState".
 */
export interface BoardState {
  items: Items
  links: Links
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "Briefing".
 */
export interface Briefing {
  when: When
  where: Where
  victim: Person
  summary: Summary
  discovery: Discovery
  coroner_report: CoronerReport
  story_hooks?: StoryHooks
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "Person".
 */
export interface Person {
  name: Name
  age?: Age
  description: Description
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "StoryHook".
 */
export interface StoryHook {
  text: Text4
  points_to_room: PointsToRoom
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "CaseSummary".
 */
export interface CaseSummary {
  case_id: CaseId
  title: Title
  difficulty: Difficulty
  player_count: PlayerCount
  summary: Summary1
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "ClueCard".
 */
export interface ClueCard {
  id: Id5
  title: Title1
  icon: ClueIcon
  text: Text5
  room: Room
  found_by: FoundBy
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "CreateLobbyRequest".
 */
export interface CreateLobbyRequest {
  player_name: PlayerName
  solo?: Solo
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "EnterRoom".
 */
export interface EnterRoom {
  room: Room1
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "GameResult".
 */
export interface GameResult {
  chosen: AccusationChoices
  correct: AccusationChoices
  score: ScoreBreakdown
  reveal: Reveal
  missed_clues: MissedClues
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "ScoreBreakdown".
 */
export interface ScoreBreakdown {
  culprit: Culprit1
  motive: Motive1
  method: Method1
  time_bonus: TimeBonus
  unused_questions: UnusedQuestions
  total: Total
  elapsed_seconds: ElapsedSeconds
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "MissedClue".
 */
export interface MissedClue {
  id: Id6
  title: Title2
  icon: ClueIcon
  text: Text6
  room: Room2
}
/**
 * Everything one player may see. Sent at the start and on every (re)connect.
 *
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "GameSnapshot".
 */
export interface GameSnapshot {
  lobby: LobbyState
  you: You
  theme: Theme
  started_at: StartedAt
  briefing: Briefing
  rooms: Rooms
  notebook: Notebook
  board: BoardState
  suspects: Suspects
  interrogations: Interrogations
  accusation_options: AccusationOptions
  accusation?: AccusationProposal | null
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "LobbyState".
 */
export interface LobbyState {
  code: Code
  status: LobbyStatus
  solo: Solo1
  players: Players
  case?: CaseSummary | null
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "Player".
 */
export interface Player {
  id: Id7
  name: Name1
  is_host: IsHost
  connected: Connected
  location?: Location
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "RoomAccess".
 */
export interface RoomAccess {
  room: Room3
  yours: Yours
  unlocked: Unlocked
  lock?: Lock
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "SuspectCard".
 */
export interface SuspectCard {
  id: Id8
  name: Name2
  role: Role
  archetype: Archetype
  initial_statement: InitialStatement
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "SuspectInterrogation".
 */
export interface SuspectInterrogation {
  suspect: Suspect1
  questions_left: QuestionsLeft
  entries: Entries
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "InterrogationEntry".
 */
export interface InterrogationEntry {
  id: Id9
  suspect: Suspect2
  asked_by: AskedBy
  question: Question1
  evidence?: Evidence1
  answer: Answer
  emotion: Emotion
  intensity: Intensity
}
/**
 * Response of every service's GET /health endpoint.
 *
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "HealthResponse".
 */
export interface HealthResponse {
  status?: Status
  service: Service
  version: Version
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "InspectAck".
 */
export interface InspectAck {
  ok: Ok1
  error?: Error1
  clues?: Clues
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "InspectObject".
 */
export interface InspectObject {
  object: Object
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "InterrogationAnswer".
 */
export interface InterrogationAnswer {
  entry: InterrogationEntry
  questions_left: QuestionsLeft1
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "JoinLobbyRequest".
 */
export interface JoinLobbyRequest {
  player_name: PlayerName1
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "LobbySession".
 */
export interface LobbySession {
  lobby_code: LobbyCode
  player_id: PlayerId
  player_token: PlayerToken
}
/**
 * Empty payload.
 *
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "Ping".
 */
export interface Ping {}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "Pong".
 */
export interface Pong {
  message: Message
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "PresenceUpdate".
 */
export interface PresenceUpdate {
  players: Players1
}
/**
 * Response of the backend's GET /api/health/ready; HTTP 503 when a dependency is down.
 *
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "ReadinessResponse".
 */
export interface ReadinessResponse {
  database: Database
  ai_service: AiService
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "RoomUnlocked".
 */
export interface RoomUnlocked {
  room: Room4
  by: By
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "SelectCase".
 */
export interface SelectCase {
  case_id: CaseId1
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "SocketAuth".
 */
export interface SocketAuth {
  lobby_code: LobbyCode1
  player_token: PlayerToken1
}
/**
 * Empty payload. Host only; needs the case's player count, or solo mode.
 *
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "StartGame".
 */
export interface StartGame {}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "SuspectRef".
 */
export interface SuspectRef {
  suspect: Suspect3
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "SuspectUnavailable".
 */
export interface SuspectUnavailable {
  suspect: Suspect4
  message: Message1
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "UnlockRoom".
 */
export interface UnlockRoom {
  room: Room5
  key_clue?: KeyClue
  code?: Code1
}
/**
 * This interface was referenced by `GameApi`'s JSON-Schema
 * via the `definition` "VoteAccusation".
 */
export interface VoteAccusation {
  proposal: Proposal
  accept: Accept
}
