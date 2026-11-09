import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_BRIEFING } from '../lib/mock'
import { BRIEFING, makeSnapshot } from '../test/fixtures'
import { useGameStore } from './gameStore'
import { useLobbyStore } from './lobbyStore'

describe('gameStore', () => {
  beforeEach(() => {
    useLobbyStore.getState().leaveLobby()
    useGameStore.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('takes the briefing and the lobby from game:snapshot', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    useGameStore.getState().applySnapshot(makeSnapshot())

    expect(useGameStore.getState().briefing).toEqual(BRIEFING)
    expect(useLobbyStore.getState().lobby?.status).toBe('playing')
  })

  it('opens the case file only once the briefing has arrived', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    useGameStore.getState().openCaseFile()
    expect(useGameStore.getState().caseFileOpen).toBe(false)

    useGameStore.getState().applySnapshot(makeSnapshot())
    useGameStore.getState().openCaseFile()
    expect(useGameStore.getState().caseFileOpen).toBe(true)

    useGameStore.getState().closeCaseFile()
    expect(useGameStore.getState().caseFileOpen).toBe(false)
  })

  it('forgets the game when the player leaves the lobby', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    useLobbyStore.setState({
      session: { lobby_code: 'CASE01', player_id: 'p1', player_token: 't' },
    })
    useGameStore.getState().applySnapshot(makeSnapshot())
    useGameStore.getState().openCaseFile()

    useLobbyStore.getState().leaveLobby()

    expect(useGameStore.getState().briefing).toBeNull()
    expect(useGameStore.getState().caseFileOpen).toBe(false)
  })

  it('uses the mock briefing when a game starts in mock mode', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    await useLobbyStore.getState().createLobby('Inspector Ion')
    useLobbyStore.getState().setLobbyState({
      ...useLobbyStore.getState().lobby!,
      status: 'playing',
    })

    expect(useGameStore.getState().briefing).toEqual(MOCK_BRIEFING)
  })

  it('has no briefing without a snapshot outside mock mode', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    useLobbyStore.getState().setLobbyState({ ...makeSnapshot().lobby })

    expect(useGameStore.getState().briefing).toBeNull()
  })
})
