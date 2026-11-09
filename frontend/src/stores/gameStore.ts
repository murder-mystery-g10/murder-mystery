import { create } from 'zustand'
import type { Briefing, GameSnapshot } from '../contracts/game-api'
import { isMockMode, MOCK_BRIEFING } from '../lib/mock'
import { socket } from '../lib/socket'
import { useLobbyStore } from './lobbyStore'

export interface GameStoreState {
  /** The player's full state from the last game:snapshot, or null before the game starts. */
  snapshot: GameSnapshot | null
  /** The case briefing and coroner report, from the snapshot (or the mock in mock mode). */
  briefing: Briefing | null
  /** Whether the case file is open. Any screen can open it with openCaseFile. */
  caseFileOpen: boolean

  applySnapshot: (snapshot: GameSnapshot) => void
  openCaseFile: () => void
  closeCaseFile: () => void
  reset: () => void
}

const initialState = {
  snapshot: null,
  briefing: null,
  caseFileOpen: false,
}

export const useGameStore = create<GameStoreState>()((set) => ({
  ...initialState,

  applySnapshot: (snapshot) => {
    set({ snapshot, briefing: snapshot.briefing })
    // The snapshot also carries the lobby, so a player who reconnects mid-game sees it as started.
    useLobbyStore.getState().setLobbyState(snapshot.lobby)
  },

  // Nothing to show before the briefing arrives.
  openCaseFile: () => set((state) => ({ caseFileOpen: state.briefing !== null })),

  closeCaseFile: () => set({ caseFileOpen: false }),

  reset: () => set(initialState),
}))

socket.on('game:snapshot', (snapshot) => {
  useGameStore.getState().applySnapshot(snapshot)
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
