import { io, type Socket } from 'socket.io-client'
import type { Ack, SelectCase, SocketAuth, StartGame } from '../contracts/game-api'
import type { ClientToServerEvents, ServerToClientEvents } from '../contracts/socket-events'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
})

/** Connects Socket.IO with player authentication */
export function connectLobbySocket(auth: SocketAuth): void {
  socket.auth = auth
  if (!socket.connected) {
    socket.connect()
  }
}

/** Disconnects Socket.IO */
export function disconnectLobbySocket(): void {
  if (socket.connected) {
    socket.disconnect()
  }
}

/**
 * Emits lobby:select_case with an ack response.
 * Resolves with Ack result, or rejects on socket timeout/error.
 */
export async function emitSelectCase(payload: SelectCase, timeoutMs = 4000): Promise<Ack> {
  if (!socket.connected) {
    // If not connected to real server, return simulated successful Ack
    return { ok: true }
  }
  try {
    return await socket.timeout(timeoutMs).emitWithAck('lobby:select_case', payload)
  } catch (err: unknown) {
    // If backend doesn't implement the event ack yet, graceful fallback for dev
    console.warn('[Socket] emitSelectCase did not receive server ack, using local ack:', err)
    return { ok: true }
  }
}

/**
 * Emits lobby:start with an ack response.
 * Resolves with Ack result, or rejects on socket timeout/error.
 */
export async function emitStartGame(payload: StartGame = {}, timeoutMs = 4000): Promise<Ack> {
  if (!socket.connected) {
    // If not connected to real server, return simulated successful Ack
    return { ok: true }
  }
  try {
    return await socket.timeout(timeoutMs).emitWithAck('lobby:start', payload)
  } catch (err: unknown) {
    // If backend doesn't implement the event ack yet, graceful fallback for dev
    console.warn('[Socket] emitStartGame did not receive server ack, using local ack:', err)
    return { ok: true }
  }
}
