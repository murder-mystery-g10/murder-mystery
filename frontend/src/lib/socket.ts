import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../contracts/socket-events'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
})
