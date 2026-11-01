import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../contracts/socket-events'

// Same origin: Vite proxies /socket.io in development, nginx in the container.
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
})
