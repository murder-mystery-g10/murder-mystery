import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as socketLib from '../lib/socket'
import { MOCK_BRIEFING } from '../lib/mock'
import { BRIEFING, GAME_RESULT, makeSnapshot } from '../test/fixtures'
import { useGameStore } from './gameStore'
import { useLobbyStore } from './lobbyStore'

describe('gameStore', () => {
  beforeEach(() => {
    useLobbyStore.getState().leaveLobby()
    useGameStore.getState().reset()
    vi.clearAllMocks()
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

  it('populates gameResult if snapshot has result and resets active accusation', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    useGameStore.setState({
      accusationModalOpen: true,
      accusation: {
        id: 'prop-1',
        proposed_by: 'p1',
        choices: { culprit: 'strat', motive: 'motive_hospital', method: 'method_bottle_swap' },
        votes: {},
      },
    })

    useGameStore.getState().applySnapshot({
      ...makeSnapshot(),
      result: GAME_RESULT,
    })

    expect(useGameStore.getState().gameResult).toEqual(GAME_RESULT)
    expect(useGameStore.getState().accusationModalOpen).toBe(false)
    expect(useGameStore.getState().accusation).toBeNull()
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

  it('opens and closes accusation modal', () => {
    useGameStore.getState().openAccusationModal()
    expect(useGameStore.getState().accusationModalOpen).toBe(true)

    useGameStore.getState().closeAccusationModal()
    expect(useGameStore.getState().accusationModalOpen).toBe(false)
  })

  it('proposes accusation via emitProposeAccusation', async () => {
    const emitSpy = vi.spyOn(socketLib, 'emitProposeAccusation').mockResolvedValue({ ok: true })

    const success = await useGameStore.getState().proposeAccusation({
      culprit: 'strat',
      motive: 'motive_hospital',
      method: 'method_bottle_swap',
    })

    expect(success).toBe(true)
    expect(emitSpy).toHaveBeenCalledWith({
      culprit: 'strat',
      motive: 'motive_hospital',
      method: 'method_bottle_swap',
    })
    expect(useGameStore.getState().accusationError).toBeNull()
  })

  it('sets accusationError when proposeAccusation fails', async () => {
    vi.spyOn(socketLib, 'emitProposeAccusation').mockResolvedValue({
      ok: false,
      error: 'Not allowed to propose now',
    })

    const success = await useGameStore.getState().proposeAccusation({
      culprit: 'strat',
      motive: 'motive_hospital',
      method: 'method_bottle_swap',
    })

    expect(success).toBe(false)
    expect(useGameStore.getState().accusationError).toBe('Not allowed to propose now')
  })

  it('votes on active accusation via emitVoteAccusation', async () => {
    const emitSpy = vi.spyOn(socketLib, 'emitVoteAccusation').mockResolvedValue({ ok: true })

    useGameStore.setState({
      accusation: {
        id: 'prop-123',
        proposed_by: 'p1',
        choices: { culprit: 'strat', motive: 'motive_hospital', method: 'method_bottle_swap' },
        votes: {},
      },
    })

    const success = await useGameStore.getState().voteAccusation(true)
    expect(success).toBe(true)
    expect(emitSpy).toHaveBeenCalledWith({ proposal: 'prop-123', accept: true })
  })

  it('stores game result and dismisses it', () => {
    useGameStore.setState({ gameResult: GAME_RESULT })
    expect(useGameStore.getState().gameResult).toEqual(GAME_RESULT)

    useGameStore.getState().dismissGameResult()
    expect(useGameStore.getState().gameResult).toBeNull()
  })
})
