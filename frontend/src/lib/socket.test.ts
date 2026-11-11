import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { connectLobbySocket, disconnectLobbySocket, socket } from './socket'
import { useConnectionStore } from '../stores/connectionStore'

const auth = { lobby_code: 'CASE01', player_token: 'test-token' }
function connectEvent() {
  socket.connected = true
  for (const listener of socket.listeners('connect')) listener()
}
beforeEach(() => {
  socket.connected = false
  socket.auth = {}
  useConnectionStore.getState().setConnected(false)
})
afterEach(() => {
  socket.connected = false
  socket.auth = {}
  vi.restoreAllMocks()
})

it('tracks transport lifecycle globally and distinguishes anonymous diagnostics from authenticated lobby membership', () => {
  connectEvent()
  expect(useConnectionStore.getState()).toMatchObject({ connected: true, lobbyCode: null })
  socket.auth = auth
  connectEvent()
  expect(useConnectionStore.getState()).toMatchObject({ connected: true, lobbyCode: 'CASE01' })
  socket.connected = false
  for (const listener of socket.listeners('disconnect')) listener('transport close')
  expect(useConnectionStore.getState()).toMatchObject({ connected: false, lobbyCode: null })
  connectEvent()
  expect(useConnectionStore.getState().connected).toBe(true)
  socket.connected = false
  for (const listener of socket.listeners('connect_error'))
    listener(new Error('Invalid credentials'))
  expect(useConnectionStore.getState()).toMatchObject({ connected: false, lobbyCode: null })
})

it('reauthenticates an anonymous connection rather than only changing socket.auth', () => {
  connectEvent()
  const disconnect = vi.spyOn(socket, 'disconnect').mockImplementation(() => {
    socket.connected = false
    for (const listener of socket.listeners('disconnect')) listener('io client disconnect')
    return socket
  })
  const connect = vi.spyOn(socket, 'connect').mockReturnValue(socket)
  connectLobbySocket(auth)
  expect(disconnect).toHaveBeenCalledTimes(1)
  expect(connect).toHaveBeenCalledTimes(1)
  expect(socket.auth).toEqual(auth)
  expect(useConnectionStore.getState().connected).toBe(false)
  connectEvent()
  expect(useConnectionStore.getState()).toMatchObject({ connected: true, lobbyCode: 'CASE01' })
  connectLobbySocket(auth)
  expect(disconnect).toHaveBeenCalledTimes(1)
  expect(connect).toHaveBeenCalledTimes(1)
})

it('clears authentication when a player explicitly leaves', () => {
  socket.auth = auth
  disconnectLobbySocket()
  expect(socket.auth).toEqual({})
})
