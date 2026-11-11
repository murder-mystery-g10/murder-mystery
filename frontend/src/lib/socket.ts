import { io, type Socket } from 'socket.io-client'
import type {
  AccusationChoices,
  Ack,
  Ask,
  BoardAddNote,
  BoardConnect,
  BoardEditNote,
  BoardMove,
  BoardPin,
  BoardRemove,
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
import { useConnectionStore } from '../stores/connectionStore'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
})

// The shared client's lifecycle owns transport state, independently of mounted pages.
socket.on('connect', () => {
  const auth = socket.auth
  const lobbyCode =
    typeof auth !== 'function' && auth?.player_token && typeof auth.lobby_code === 'string'
      ? auth.lobby_code
      : null
  useConnectionStore.getState().setConnected(socket.connected, lobbyCode)
})
socket.on('disconnect', () => useConnectionStore.getState().setConnected(false))
socket.on('connect_error', () => useConnectionStore.getState().setConnected(false))

const NOT_CONNECTED = 'Not connected to the game server. Reload the page and try again.'
const NO_ANSWER = 'The game server did not answer in time. Try again.'
const BOARD_REQUIRES_SERVER =
  'The shared board needs a live game server. Set VITE_USE_MOCK=false and restart the frontend.'

/** Connects Socket.IO with player authentication */
export function connectLobbySocket(auth: SocketAuth): void {
  const previous = socket.auth
  // Changing auth on a connected client does not authenticate its existing server session.
  // In particular, a status-page connection may be anonymous (system:ping only).
  if (
    typeof previous === 'function' ||
    previous?.lobby_code !== auth.lobby_code ||
    previous?.player_token !== auth.player_token
  ) {
    socket.disconnect()
  }
  socket.auth = auth
  if (!socket.connected) {
    socket.connect()
  }
}

/** Disconnects Socket.IO and stops any reconnection attempts */
export function disconnectLobbySocket(): void {
  socket.disconnect()
  socket.auth = {}
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

async function emitBoardAction(
  send: (timeoutMs: number) => Promise<Ack>,
  timeoutMs = 4000,
): Promise<Ack> {
  if (isMockMode()) return { ok: false, error: BOARD_REQUIRES_SERVER }
  if (!socket.connected) return { ok: false, error: NOT_CONNECTED }
  try {
    return await send(timeoutMs)
  } catch {
    return { ok: false, error: NO_ANSWER }
  }
}

export function emitBoardPin(payload: BoardPin, timeoutMs = 4000): Promise<Ack> {
  return emitBoardAction(
    (timeout) => socket.timeout(timeout).emitWithAck('board:pin', payload),
    timeoutMs,
  )
}

export function emitBoardAddNote(payload: BoardAddNote, timeoutMs = 4000): Promise<Ack> {
  return emitBoardAction(
    (timeout) => socket.timeout(timeout).emitWithAck('board:add_note', payload),
    timeoutMs,
  )
}

export function emitBoardEditNote(payload: BoardEditNote, timeoutMs = 4000): Promise<Ack> {
  return emitBoardAction(
    (timeout) => socket.timeout(timeout).emitWithAck('board:edit_note', payload),
    timeoutMs,
  )
}

export function emitBoardMove(payload: BoardMove, timeoutMs = 4000): Promise<Ack> {
  return emitBoardAction(
    (timeout) => socket.timeout(timeout).emitWithAck('board:move', payload),
    timeoutMs,
  )
}

export function emitBoardConnect(payload: BoardConnect, timeoutMs = 4000): Promise<Ack> {
  return emitBoardAction(
    (timeout) => socket.timeout(timeout).emitWithAck('board:connect', payload),
    timeoutMs,
  )
}

export function emitBoardRemove(payload: BoardRemove, timeoutMs = 4000): Promise<Ack> {
  return emitBoardAction(
    (timeout) => socket.timeout(timeout).emitWithAck('board:remove', payload),
    timeoutMs,
  )
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

/** Ack follows the AI call, whose backend timeout is 30 seconds. */
export async function emitAsk(payload: Ask): Promise<Ack> {
  if (isMockMode()) return { ok: false, error: 'Interrogation requires a live game server.' }
  if (!socket.connected) return { ok: false, error: NOT_CONNECTED }
  try {
    return await socket.timeout(45000).emitWithAck('interrogation:ask', payload)
  } catch {
    return {
      ok: false,
      error:
        'Connection interrupted. Reconnect to confirm the interview history before trying again.',
    }
  }
}
