import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { StatusPage } from './StatusPage'
import { socket } from '../lib/socket'
import { useConnectionStore } from '../stores/connectionStore'

afterEach(() => {
  socket.connected = false
  socket.auth = {}
  useConnectionStore.getState().setConnected(false)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('pings an already connected shared client and leaves it connected when diagnostics unmounts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ database: true, ai_service: true })),
  )
  const ping = vi.fn(async () => ({ message: 'pong' }))
  vi.spyOn(socket, 'timeout').mockReturnValue({ emitWithAck: ping } as never)
  const connect = vi.spyOn(socket, 'connect').mockReturnValue(socket)
  const disconnect = vi.spyOn(socket, 'disconnect').mockReturnValue(socket)
  socket.auth = { lobby_code: 'CASE01', player_token: 'token' }
  socket.connected = true
  for (const listener of socket.listeners('connect')) listener()
  const { unmount } = render(<StatusPage />)
  await waitFor(() => expect(ping).toHaveBeenCalledWith('system:ping', {}))
  expect(screen.getByText('Socket.IO')).toBeInTheDocument()
  expect(connect).not.toHaveBeenCalled()
  unmount()
  expect(disconnect).not.toHaveBeenCalled()
  expect(useConnectionStore.getState()).toMatchObject({ connected: true, lobbyCode: 'CASE01' })
})
