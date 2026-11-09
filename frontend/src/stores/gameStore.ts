import { create } from 'zustand'
import type { Ack, Briefing, GameSnapshot } from '../contracts/game-api'
import { isMockMode, makeMockSnapshot } from '../lib/mock'
import { emitEnterRoom, socket } from '../lib/socket'
import { useLobbyStore } from './lobbyStore'

export interface GameStoreState {
  /** The player's full state from the last game:snapshot, or null before the game starts. */
  snapshot: GameSnapshot | null
  /** The case briefing and coroner report from the snapshot. */
  briefing: Briefing | null
  /** Whether the case file is open. Any screen can open it with openCaseFile. */
  caseFileOpen: boolean

  applySnapshot: (snapshot: GameSnapshot) => void
  enterRoom: (room: string) => Promise<Ack>
  openCaseFile: () => void
  closeCaseFile: () => void
  reset: () => void
}

const initialState = {
  snapshot: null,
  briefing: null,
  caseFileOpen: false,
}

export const useGameStore = create<GameStoreState>()((set, get) => ({
  ...initialState,

  applySnapshot: (snapshot) => {
    set({ snapshot, briefing: snapshot.briefing })
    // The snapshot also carries the lobby, so a player who reconnects mid-game sees it as started.
    useLobbyStore.getState().setLobbyState(snapshot.lobby)
  },

  enterRoom: async (room) => {
    const game = get().snapshot
    if (!game) return { ok: false }

    const ack = await emitEnterRoom({ room })
    if (ack.ok) {
      const current = get().snapshot
      if (
        current &&
        current.lobby.code === game.lobby.code &&
        current.started_at === game.started_at &&
        current.you === game.you
      ) {
        const players = current.lobby.players.map((player) =>
          player.id === current.you ? { ...player, location: room } : player,
        )
        set({ snapshot: { ...current, lobby: { ...current.lobby, players } } })
      }
    }
    return ack
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
  // Seed a playable room preview when mock mode starts without a server snapshot.
  if (
    isMockMode() &&
    lobbyState.session &&
    lobbyState.lobby?.status === 'playing' &&
    useGameStore.getState().snapshot === null
  ) {
    useGameStore
      .getState()
      .applySnapshot(makeMockSnapshot(lobbyState.lobby, lobbyState.session.player_id))
  }
})
