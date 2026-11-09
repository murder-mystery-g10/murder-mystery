import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { socket } from '../lib/socket'
import { useCanStartGame, useIsHost, useLobbyStore } from './lobbyStore'

describe('lobbyStore', () => {
  beforeEach(() => {
    useLobbyStore.getState().leaveLobby()
    useLobbyStore.setState({ cases: [], isLoading: false })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('in mock mode', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_MOCK', 'true')
      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          throw new Error('mock mode must not call the backend')
        }),
      )
    })

    it('creates a lobby and sets the player as host', async () => {
      await useLobbyStore.getState().createLobby('Inspector Ion')

      const state = useLobbyStore.getState()
      expect(state.session).toBeTruthy()
      expect(state.lobby?.code).toBeTruthy()
      expect(state.lobby?.players[0].name).toBe('Inspector Ion')
      expect(state.lobby?.players[0].is_host).toBe(true)
      expect(state.cases[0].title).toBe('Death at Vornicu Manor')

      const { result } = renderHook(() => useIsHost())
      expect(result.current).toBe(true)
    })

    it('joins a lobby and adds player as guest', async () => {
      await useLobbyStore.getState().joinLobby('CRIME42', 'Detective Radu')

      const state = useLobbyStore.getState()
      expect(state.session?.lobby_code).toBe('CRIME42')
      expect(state.lobby?.code).toBe('CRIME42')
      const guestPlayer = state.lobby?.players.find((p) => p.name === 'Detective Radu')
      expect(guestPlayer?.is_host).toBe(false)

      const { result } = renderHook(() => useIsHost())
      expect(result.current).toBe(false)
    })

    it('validates canStartGame based on player count and limits players to 4', async () => {
      await useLobbyStore.getState().createLobby('Inspector Ion')
      await useLobbyStore.getState().selectCase('vornicu_1926')
      expect(useLobbyStore.getState().lobby?.case?.case_id).toBe('vornicu_1926')

      const { result, rerender } = renderHook(() => useCanStartGame())
      expect(result.current.canStart).toBe(false)
      expect(result.current.reason).toBe('This case needs 4 detectives (1/4 present).')

      useLobbyStore.getState().simulateAddPlayer('P2')
      useLobbyStore.getState().simulateAddPlayer('P3')
      useLobbyStore.getState().simulateAddPlayer('P4')
      expect(useLobbyStore.getState().lobby?.players.length).toBe(4)

      // A 5th player is refused
      useLobbyStore.getState().simulateAddPlayer('P5')
      expect(useLobbyStore.getState().lobby?.players.length).toBe(4)

      rerender()
      expect(result.current.canStart).toBe(true)
      expect(result.current.reason).toBeNull()

      await useLobbyStore.getState().startGame()
      expect(useLobbyStore.getState().lobby?.status).toBe('playing')
      expect(useLobbyStore.getState().error).toBeNull()
    })
  })

  describe('without mock mode', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_MOCK', 'false')
      vi.spyOn(socket, 'connect').mockReturnValue(socket)
    })

    it('creates a lobby from the backend session and connects the socket', async () => {
      const session = { lobby_code: 'REAL01', player_id: 'p1', player_token: 't1' }
      const cases = [
        {
          case_id: 'c1',
          title: 'Backend Case',
          difficulty: 'easy',
          player_count: 2,
          summary: 's',
        },
      ]
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          url === '/api/cases' ? Response.json(cases) : Response.json(session, { status: 201 }),
        ),
      )

      await useLobbyStore.getState().createLobby('Inspector Ion')

      const state = useLobbyStore.getState()
      expect(state.session).toEqual(session)
      expect(state.lobby?.code).toBe('REAL01')
      expect(state.cases).toEqual(cases)
      expect(state.error).toBeNull()
      expect(socket.connect).toHaveBeenCalled()
    })

    it.each([
      [409, { detail: 'The name is already taken' }, 'The name is already taken'],
      [409, {}, 'That name is already taken in this lobby. Choose another name.'],
      [404, { detail: 'Not Found' }, 'No lobby with code CRIME42 exists.'],
      [501, { detail: 'Not implemented yet' }, 'The server does not support this yet.'],
      [500, {}, 'The game server ran into a problem (error 500).'],
    ])('passes a %i from join to the player', async (status, body, message) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(body, { status })),
      )

      await expect(
        useLobbyStore.getState().joinLobby('crime42', 'Detective Radu'),
      ).rejects.toMatchObject({ status })

      const state = useLobbyStore.getState()
      expect(state.error).toContain(message)
      expect(state.lobby).toBeNull()
      expect(state.session).toBeNull()
      expect(state.isLoading).toBe(false)
    })

    it('reports an unreachable server', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        }),
      )

      await expect(useLobbyStore.getState().createLobby('Inspector Ion')).rejects.toThrow()
      expect(useLobbyStore.getState().error).toBe(
        'Cannot reach the game server. Check your connection and try again.',
      )
    })

    it('does not fake a successful ack when the socket is not connected', async () => {
      useLobbyStore.setState({
        lobby: { code: 'REAL01', status: 'waiting', solo: false, players: [], case: null },
      })

      await useLobbyStore.getState().selectCase('vornicu_1926')
      await useLobbyStore.getState().startGame()

      const state = useLobbyStore.getState()
      expect(state.error).toBe('Not connected to the game server. Reload the page and try again.')
      expect(state.lobby?.case).toBeNull()
      expect(state.lobby?.status).toBe('waiting')
    })

    it('shows the error from a server ack with ok: false', async () => {
      vi.spyOn(socket, 'connected', 'get').mockReturnValue(true)
      const emitWithAck = vi.fn(async () => ({ ok: false, error: 'Only the host can start' }))
      vi.spyOn(socket, 'timeout').mockReturnValue({ emitWithAck } as never)
      useLobbyStore.setState({
        lobby: { code: 'REAL01', status: 'waiting', solo: false, players: [], case: null },
      })

      await useLobbyStore.getState().startGame()

      expect(emitWithAck).toHaveBeenCalledWith('lobby:start', {})
      expect(useLobbyStore.getState().error).toBe('Only the host can start')
      expect(useLobbyStore.getState().lobby?.status).toBe('waiting')
    })

    it('shows an error when the server does not answer the ack', async () => {
      vi.spyOn(socket, 'connected', 'get').mockReturnValue(true)
      const emitWithAck = vi.fn(async () => {
        throw new Error('operation has timed out')
      })
      vi.spyOn(socket, 'timeout').mockReturnValue({ emitWithAck } as never)
      useLobbyStore.setState({
        lobby: { code: 'REAL01', status: 'waiting', solo: false, players: [], case: null },
      })

      await useLobbyStore.getState().selectCase('vornicu_1926')

      expect(useLobbyStore.getState().error).toBe(
        'The game server did not answer in time. Try again.',
      )
      expect(useLobbyStore.getState().lobby?.case).toBeNull()
    })
  })
})
