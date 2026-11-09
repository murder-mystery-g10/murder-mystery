import { io, type Socket } from 'socket.io-client'
import type {
  AccusationChoices,
  Ack,
  EnterRoom,
  InspectAck,
  InspectObject,
  SelectCase,
  SocketAuth,
  StartGame,
  UnlockRoom,
  VoteAccusation,
} from '../contracts/game-api'
import type { ClientToServerEvents, ServerToClientEvents } from '../contracts/socket-events'
import { isMockMode } from './mock'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
})

const NOT_CONNECTED = 'Not connected to the game server. Reload the page and try again.'
const NO_ANSWER = 'The game server did not answer in time. Try again.'

/** Connects Socket.IO with player authentication */
export function connectLobbySocket(auth: SocketAuth): void {
  socket.auth = auth
  if (!socket.connected) {
    socket.connect()
  }
}

/** Disconnects Socket.IO and stops any reconnection attempts */
export function disconnectLobbySocket(): void {
  socket.disconnect()
}

/**
 * Emits lobby:select_case and resolves with the server's Ack. A missing connection or a timeout
 * resolves with ok: false and a message for the player. In mock mode it always succeeds.
 */
export async function emitSelectCase(payload: SelectCase, timeoutMs = 4000): Promise<Ack> {
  if (isMockMode()) return { ok: true }
  if (!socket.connected) return { ok: false, error: NOT_CONNECTED }
  try {
    return await socket.timeout(timeoutMs).emitWithAck('lobby:select_case', payload)
  } catch {
    return { ok: false, error: NO_ANSWER }
  }
}

/**
 * Emits lobby:start and resolves with the server's Ack. A missing connection or a timeout
 * resolves with ok: false and a message for the player. In mock mode it always succeeds.
 */
export async function emitStartGame(payload: StartGame = {}, timeoutMs = 4000): Promise<Ack> {
  if (isMockMode()) return { ok: true }
  if (!socket.connected) return { ok: false, error: NOT_CONNECTED }
  try {
    return await socket.timeout(timeoutMs).emitWithAck('lobby:start', payload)
  } catch {
    return { ok: false, error: NO_ANSWER }
  }
}

export async function emitEnterRoom(payload: EnterRoom, timeoutMs = 4000): Promise<Ack> {
  if (isMockMode()) return { ok: true }
  if (!socket.connected) return { ok: false, error: NOT_CONNECTED }
  try {
    return await socket.timeout(timeoutMs).emitWithAck('room:enter', payload)
  } catch {
    return { ok: false, error: NO_ANSWER }
  }
}

export async function emitInspectObject(
  payload: InspectObject,
  timeoutMs = 4000,
): Promise<InspectAck> {
  if (!socket.connected) return { ok: false, error: NOT_CONNECTED }
  try {
    return await socket.timeout(timeoutMs).emitWithAck('object:inspect', payload)
  } catch {
    return { ok: false, error: NO_ANSWER }
  }
}

export async function emitUnlockRoom(payload: UnlockRoom, timeoutMs = 4000): Promise<Ack> {
  if (!socket.connected) return { ok: false, error: NOT_CONNECTED }
  try {
    return await socket.timeout(timeoutMs).emitWithAck('room:unlock', payload)
  } catch {
    return { ok: false, error: NO_ANSWER }
  }
}

/**
 * Emits accusation:propose and resolves with the server's Ack.
 */
export async function emitProposeAccusation(
  payload: AccusationChoices,
  timeoutMs = 4000,
): Promise<Ack> {
  if (isMockMode()) return { ok: true }
  if (!socket.connected) return { ok: false, error: NOT_CONNECTED }
  try {
    return await socket.timeout(timeoutMs).emitWithAck('accusation:propose', payload)
  } catch {
    return { ok: false, error: NO_ANSWER }
  }
}

/**
 * Emits accusation:vote and resolves with the server's Ack.
 */
export async function emitVoteAccusation(payload: VoteAccusation, timeoutMs = 4000): Promise<Ack> {
  if (isMockMode()) return { ok: true }
  if (!socket.connected) return { ok: false, error: NOT_CONNECTED }
  try {
    return await socket.timeout(timeoutMs).emitWithAck('accusation:vote', payload)
  } catch {
    return { ok: false, error: NO_ANSWER }
  }
}
