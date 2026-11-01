/* eslint-disable */
/** Generated from docs/contracts by scripts/gen-contracts.mjs. Do not edit by hand. */
import type * as Api from './game-api'

/** Events the client emits; the server answers each one with an ack. */
export interface ClientToServerEvents {
  /** Connectivity check */
  'system:ping': (payload: Api.Ping, ack: (response: Api.Pong) => void) => void
  /** Host picks the case */
  'lobby:select_case': (payload: Api.SelectCase, ack: (response: Api.Ack) => void) => void
  /** Host starts the game */
  'lobby:start': (payload: Api.StartGame, ack: (response: Api.Ack) => void) => void
  /** Move to one of your rooms, or to the station */
  'room:enter': (payload: Api.EnterRoom, ack: (response: Api.Ack) => void) => void
  /** Use a key from your notebook or enter a code */
  'room:unlock': (payload: Api.UnlockRoom, ack: (response: Api.Ack) => void) => void
  /** Click an object; found clues go to your notebook */
  'object:inspect': (payload: Api.InspectObject, ack: (response: Api.InspectAck) => void) => void
  /** Pin a clue, suspect or quote (station only) */
  'board:pin': (payload: Api.BoardPin, ack: (response: Api.Ack) => void) => void
  /** Add a free note */
  'board:add_note': (payload: Api.BoardAddNote, ack: (response: Api.Ack) => void) => void
  /** Edit a note */
  'board:edit_note': (payload: Api.BoardEditNote, ack: (response: Api.Ack) => void) => void
  /** Move an item */
  'board:move': (payload: Api.BoardMove, ack: (response: Api.Ack) => void) => void
  /** Link two items with a string */
  'board:connect': (payload: Api.BoardConnect, ack: (response: Api.Ack) => void) => void
  /** Remove an item or a link */
  'board:remove': (payload: Api.BoardRemove, ack: (response: Api.Ack) => void) => void
  /** Ask a suspect (station only); uses one of the team's questions */
  'interrogation:ask': (payload: Api.Ask, ack: (response: Api.Ack) => void) => void
  /** Propose the final accusation */
  'accusation:propose': (payload: Api.AccusationChoices, ack: (response: Api.Ack) => void) => void
  /** Accept or reject the proposal */
  'accusation:vote': (payload: Api.VoteAccusation, ack: (response: Api.Ack) => void) => void
}

/** Events the server emits. */
export interface ServerToClientEvents {
  /** Lobby changed; sent to everyone in it */
  'lobby:state': (payload: Api.LobbyState) => void
  /** Full personal state, at start and on reconnect */
  'game:snapshot': (payload: Api.GameSnapshot) => void
  /** Who is where (top bar) */
  'presence:update': (payload: Api.PresenceUpdate) => void
  /** A door opened for everyone with access */
  'room:unlocked': (payload: Api.RoomUnlocked) => void
  /** The whole board, after every change */
  'board:state': (payload: Api.BoardState) => void
  /** A suspect is answering; wait for them */
  'interrogation:thinking': (payload: Api.SuspectRef) => void
  /** A suspect answered */
  'interrogation:answer': (payload: Api.InterrogationAnswer) => void
  /** The AI did not answer; the question was not used */
  'interrogation:unavailable': (payload: Api.SuspectUnavailable) => void
  /** Accusation proposed, voted or rejected */
  'accusation:state': (payload: Api.AccusationState) => void
  /** Score, correct answers, reveal and missed clues */
  'game:ended': (payload: Api.GameResult) => void
}
