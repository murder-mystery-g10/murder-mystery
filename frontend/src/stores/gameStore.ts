import { create } from 'zustand'
import type {
  AccusationChoices,
  AccusationProposal,
  Ack,
  Briefing,
  GameResult,
  GameSnapshot,
  InspectAck,
  UnlockRoom,
} from '../contracts/game-api'
import { isMockMode, makeMockSnapshot, mockInspection, mockUnlockRoom } from '../lib/mock'
import {
  emitEnterRoom,
  emitInspectObject,
  emitProposeAccusation,
  emitUnlockRoom,
  emitVoteAccusation,
  socket,
} from '../lib/socket'
import { useLobbyStore } from './lobbyStore'

export interface GameStoreState {
  /** The player's full state from the last game:snapshot, or null before the game starts. */
  snapshot: GameSnapshot | null
  /** The case briefing and coroner report from the snapshot. */
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
  enterRoom: (room: string) => Promise<Ack>
  unlockRoom: (request: UnlockRoom) => Promise<Ack>
  markRoomUnlocked: (room: string) => void
  inspectObject: (object: string) => Promise<InspectAck>
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

function sameGame(current: GameSnapshot, previous: GameSnapshot) {
  return (
    current.lobby.code === previous.lobby.code &&
    current.started_at === previous.started_at &&
    current.you === previous.you
  )
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

  enterRoom: async (room) => {
    const game = get().snapshot
    if (!game) return { ok: false }

    const ack = await emitEnterRoom({ room })
    if (ack.ok) {
      const current = get().snapshot
      // A newer presence event or snapshot takes precedence over this acknowledgment.
      if (current && sameGame(current, game) && current.lobby.players === game.lobby.players) {
        const players = current.lobby.players.map((player) =>
          player.id === current.you ? { ...player, location: room } : player,
        )
        set({ snapshot: { ...current, lobby: { ...current.lobby, players } } })
      }
    }
    return ack
  },

  unlockRoom: async (request) => {
    const game = get().snapshot
    if (!game) return { ok: false }

    const ack = isMockMode()
      ? mockUnlockRoom(request, game.notebook)
      : await emitUnlockRoom(request)
    const current = get().snapshot
    if (ack.ok && current && sameGame(current, game)) get().markRoomUnlocked(request.room)
    return ack
  },

  markRoomUnlocked: (id) => {
    const snapshot = get().snapshot
    const room = snapshot?.rooms.find((room) => room.room === id)
    if (!snapshot || !room?.yours || room.unlocked) return

    const rooms = snapshot.rooms.map((entry) =>
      entry === room ? { ...entry, unlocked: true } : entry,
    )
    set({ snapshot: { ...snapshot, rooms } })
  },

  inspectObject: async (object) => {
    const game = get().snapshot
    if (!game) return { ok: false }

    const ack = isMockMode()
      ? mockInspection(object, game.you)
      : await emitInspectObject({ object })
    const current = get().snapshot
    if (ack.ok && ack.clues?.length && current && sameGame(current, game)) {
      const notebook = new Map(current.notebook.map((clue) => [clue.id, clue]))
      for (const clue of ack.clues) notebook.set(clue.id, clue)
      set({ snapshot: { ...current, notebook: [...notebook.values()] } })
    }
    return ack
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

socket.on('presence:update', ({ players }) => {
  const { snapshot } = useGameStore.getState()
  if (snapshot && players.some((player) => player.id === snapshot.you)) {
    useGameStore.setState({ snapshot: { ...snapshot, lobby: { ...snapshot.lobby, players } } })
  }
})

socket.on('room:unlocked', ({ room }) => {
  useGameStore.getState().markRoomUnlocked(room)
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
