import { create } from 'zustand'
import type {
  AccusationChoices,
  AccusationProposal,
  Briefing,
  GameResult,
  GameSnapshot,
} from '../contracts/game-api'
import { isMockMode, MOCK_BRIEFING } from '../lib/mock'
import { emitProposeAccusation, emitVoteAccusation, socket } from '../lib/socket'
import { useLobbyStore } from './lobbyStore'

export interface GameStoreState {
  /** The player's full state from the last game:snapshot, or null before the game starts. */
  snapshot: GameSnapshot | null
  /** The case briefing and coroner report, from the snapshot (or the mock in mock mode). */
  briefing: Briefing | null
  /** Whether the case file is open. Any screen can open it with openCaseFile. */
  caseFileOpen: boolean

  /** Current pending accusation proposal, if any. */
  accusation: AccusationProposal | null
  /** Whether the accusation dialog is open. */
  accusationModalOpen: boolean
  /** Final result when the game ends. */
  gameResult: GameResult | null
  /** Loading state during accusation submission or voting. */
  isSubmittingAccusation: boolean
  /** Error message from accusation submission or voting. */
  accusationError: string | null

  applySnapshot: (snapshot: GameSnapshot) => void
  openCaseFile: () => void
  closeCaseFile: () => void
  openAccusationModal: () => void
  closeAccusationModal: () => void
  clearAccusationError: () => void
  dismissGameResult: () => void

  proposeAccusation: (choices: AccusationChoices) => Promise<boolean>
  voteAccusation: (accept: boolean) => Promise<boolean>
  reset: () => void
}

const initialState = {
  snapshot: null,
  briefing: null,
  caseFileOpen: false,
  accusation: null,
  accusationModalOpen: false,
  gameResult: null,
  isSubmittingAccusation: false,
  accusationError: null,
}

export const useGameStore = create<GameStoreState>()((set, get) => ({
  ...initialState,

  applySnapshot: (snapshot) => {
    const gameResult = snapshot.result ?? get().gameResult
    set({
      snapshot,
      briefing: snapshot.briefing,
      accusation: snapshot.result ? null : (snapshot.accusation ?? null),
      accusationModalOpen: snapshot.result ? false : get().accusationModalOpen,
      gameResult,
    })
    // The snapshot also carries the lobby, so a player who reconnects mid-game sees it as started.
    useLobbyStore.getState().setLobbyState(snapshot.lobby)
  },

  // Nothing to show before the briefing arrives.
  openCaseFile: () => set((state) => ({ caseFileOpen: state.briefing !== null })),
  closeCaseFile: () => set({ caseFileOpen: false }),

  openAccusationModal: () => set({ accusationModalOpen: true, accusationError: null }),
  closeAccusationModal: () => set({ accusationModalOpen: false, accusationError: null }),
  clearAccusationError: () => set({ accusationError: null }),
  dismissGameResult: () => set({ gameResult: null }),

  proposeAccusation: async (choices) => {
    set({ isSubmittingAccusation: true, accusationError: null })
    try {
      const ack = await emitProposeAccusation(choices)
      if (!ack.ok) {
        set({ accusationError: ack.error ?? 'Failed to propose accusation.' })
        return false
      }
      return true
    } catch {
      set({ accusationError: 'Failed to propose accusation.' })
      return false
    } finally {
      set({ isSubmittingAccusation: false })
    }
  },

  voteAccusation: async (accept) => {
    const proposalId = get().accusation?.id
    if (!proposalId) return false
    set({ isSubmittingAccusation: true, accusationError: null })
    try {
      const ack = await emitVoteAccusation({ proposal: proposalId, accept })
      if (!ack.ok) {
        set({ accusationError: ack.error ?? 'Failed to submit vote.' })
        return false
      }
      return true
    } catch {
      set({ accusationError: 'Failed to submit vote.' })
      return false
    } finally {
      set({ isSubmittingAccusation: false })
    }
  },

  reset: () => set(initialState),
}))

socket.on('game:snapshot', (snapshot) => {
  useGameStore.getState().applySnapshot(snapshot)
})

socket.on('accusation:state', ({ proposal }) => {
  useGameStore.setState({
    accusation: proposal,
    // Automatically open the dialog if there's an active proposal so all detectives can review and vote
    accusationModalOpen: proposal !== null ? true : useGameStore.getState().accusationModalOpen,
  })
})

socket.on('game:ended', (result) => {
  useGameStore.setState({
    gameResult: result,
    accusationModalOpen: false,
    accusation: null,
  })
})

useLobbyStore.subscribe((lobbyState, previous) => {
  // Leaving the lobby ends the game for this player.
  if (previous.session && !lobbyState.session) {
    useGameStore.getState().reset()
    return
  }
  // Mock mode has no server to send game:snapshot, so the started game gets the mock briefing.
  if (
    isMockMode() &&
    lobbyState.lobby?.status === 'playing' &&
    useGameStore.getState().briefing === null
  ) {
    useGameStore.setState({ briefing: MOCK_BRIEFING })
  }
})
