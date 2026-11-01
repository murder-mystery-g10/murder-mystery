import { io } from 'socket.io-client'

// Same origin: Vite proxies /socket.io in development, Caddy in production.
export const socket = io({ autoConnect: false })
