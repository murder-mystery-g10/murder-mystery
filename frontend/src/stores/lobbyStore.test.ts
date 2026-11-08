import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanStartGame, useIsHost, useLobbyStore } from './lobbyStore'

describe('lobbyStore', () => {
  beforeEach(() => {
    useLobbyStore.getState().leaveLobby()
  })

  it('creates a lobby and sets the player as host', async () => {
    await useLobbyStore.getState().createLobby('Comisar Ion')

    const state = useLobbyStore.getState()
    expect(state.session).toBeTruthy()
    expect(state.lobby).toBeTruthy()
    expect(state.lobby?.code).toBeTruthy()
    expect(state.lobby?.players[0].name).toBe('Comisar Ion')
    expect(state.lobby?.players[0].is_host).toBe(true)

    const { result } = renderHook(() => useIsHost())
    expect(result.current).toBe(true)
  })

  it('joins a lobby and adds player as guest', async () => {
    await useLobbyStore.getState().joinLobby('CRIME42', 'Detectiv Radu')

    const state = useLobbyStore.getState()
    expect(state.session?.lobby_code).toBe('CRIME42')
    expect(state.lobby?.code).toBe('CRIME42')
    const guestPlayer = state.lobby?.players.find((p) => p.name === 'Detectiv Radu')
    expect(guestPlayer?.is_host).toBe(false)

    const { result } = renderHook(() => useIsHost())
    expect(result.current).toBe(false)
  })

  it('allows selecting a case', async () => {
    await useLobbyStore.getState().createLobby('Comisar Ion')
    await useLobbyStore.getState().loadCases()

    await useLobbyStore.getState().selectCase('vornicu_1926')
    const state = useLobbyStore.getState()
    expect(state.lobby?.case?.case_id).toBe('vornicu_1926')
  })

  it('validates canStartGame based on player count and limits players to 4', async () => {
    // Multiplayer: needs 4 players for vornicu_1926
    await useLobbyStore.getState().createLobby('Comisar Ion')
    await useLobbyStore.getState().loadCases()
    await useLobbyStore.getState().selectCase('vornicu_1926')

    const { result, rerender } = renderHook(() => useCanStartGame())
    expect(result.current.canStart).toBe(false)
    expect(result.current.reason).toContain('Sunt necesari 4 detectivi')

    // Simulate 3 more players joining
    useLobbyStore.getState().simulateAddPlayer('P2')
    useLobbyStore.getState().simulateAddPlayer('P3')
    useLobbyStore.getState().simulateAddPlayer('P4')

    expect(useLobbyStore.getState().lobby?.players.length).toBe(4)

    // Attempting to add a 5th player is prevented
    useLobbyStore.getState().simulateAddPlayer('P5')
    expect(useLobbyStore.getState().lobby?.players.length).toBe(4)

    rerender()
    expect(result.current.canStart).toBe(true)
    expect(result.current.reason).toBeNull()

    // Start game
    await useLobbyStore.getState().startGame()
    expect(useLobbyStore.getState().lobby?.status).toBe('playing')
  })
})
