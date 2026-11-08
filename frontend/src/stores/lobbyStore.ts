import { create } from 'zustand'
import type { CaseSummary, LobbySession, LobbyState, Player } from '../contracts/game-api'
import {
  createLobby as apiCreateLobby,
  fetchCases as apiFetchCases,
  joinLobby as apiJoinLobby,
} from '../lib/api'
import {
  connectLobbySocket,
  disconnectLobbySocket,
  emitSelectCase,
  emitStartGame,
  socket,
} from '../lib/socket'

const STORAGE_KEY = 'mm_lobby_session'

function getStoredSession(): LobbySession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LobbySession) : null
  } catch {
    return null
  }
}

function persistSession(session: LobbySession | null): void {
  try {
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // sessionStorage not available (e.g. strict privacy mode)
  }
}

export interface LobbyStoreState {
  session: LobbySession | null
  lobby: LobbyState | null
  cases: CaseSummary[]
  isLoading: boolean
  error: string | null
  isMock: boolean

  // Actions
  createLobby: (playerName: string) => Promise<void>
  joinLobby: (code: string, playerName: string) => Promise<void>
  loadCases: () => Promise<void>
  selectCase: (caseId: string) => Promise<void>
  startGame: () => Promise<void>
  leaveLobby: () => void
  clearError: () => void

  // Simulation helpers for testing / dev mode
  simulateAddPlayer: (playerName?: string) => void
  setLobbyState: (state: LobbyState) => void
}

let socketListenerRegistered = false

function setupSocketListener(
  set: (fn: (state: LobbyStoreState) => Partial<LobbyStoreState>) => void,
) {
  if (socketListenerRegistered) return
  socketListenerRegistered = true

  socket.on('lobby:state', (updatedState: LobbyState) => {
    set(() => ({ lobby: updatedState }))
  })
}

export const useLobbyStore = create<LobbyStoreState>()((set, get) => {
  setupSocketListener(set)

  return {
    session: getStoredSession(),
    lobby: null,
    cases: [],
    isLoading: false,
    error: null,
    isMock: false,

    createLobby: async (playerName: string) => {
      set({ isLoading: true, error: null })
      try {
        const { session, isMock } = await apiCreateLobby({
          player_name: playerName.trim(),
          solo: false,
        })
        persistSession(session)

        const initialPlayer: Player = {
          id: session.player_id,
          name: playerName.trim(),
          is_host: true,
          connected: true,
          location: null,
        }

        const initialLobby: LobbyState = {
          code: session.lobby_code,
          status: 'waiting',
          solo: false,
          players: [initialPlayer],
          case: null,
        }

        set({
          session,
          lobby: initialLobby,
          isLoading: false,
          isMock,
        })

        // Connect socket with credentials
        connectLobbySocket({
          lobby_code: session.lobby_code,
          player_token: session.player_token,
        })

        // Fetch available cases
        await get().loadCases()
      } catch (err: unknown) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Nu s-a putut crea camera',
        })
        throw err
      }
    },

    joinLobby: async (code: string, playerName: string) => {
      set({ isLoading: true, error: null })
      const normalizedCode = code.trim().toUpperCase()

      try {
        const { session, isMock } = await apiJoinLobby(normalizedCode, {
          player_name: playerName.trim(),
        })
        persistSession(session)

        const initialPlayer: Player = {
          id: session.player_id,
          name: playerName.trim(),
          is_host: false,
          connected: true,
          location: null,
        }

        const initialLobby: LobbyState = {
          code: normalizedCode,
          status: 'waiting',
          solo: false,
          players: [
            {
              id: 'host_player_1',
              name: 'Comisar Vasile (Gazdă)',
              is_host: true,
              connected: true,
              location: null,
            },
            initialPlayer,
          ],
          case: null,
        }

        set({
          session,
          lobby: initialLobby,
          isLoading: false,
          isMock,
        })

        // Connect socket with credentials
        connectLobbySocket({
          lobby_code: session.lobby_code,
          player_token: session.player_token,
        })

        // Fetch available cases
        await get().loadCases()
      } catch (err: unknown) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Nu s-a putut alătura camerei',
        })
        throw err
      }
    },

    loadCases: async () => {
      try {
        const cases = await apiFetchCases()
        set({ cases })
      } catch (err: unknown) {
        console.error('Failed to load cases:', err)
      }
    },

    selectCase: async (caseId: string) => {
      const { lobby, cases } = get()
      if (!lobby) return

      const chosenCase = cases.find((c) => c.case_id === caseId) ?? null
      set({ isLoading: true, error: null })

      try {
        const ack = await emitSelectCase({ case_id: caseId })
        if (!ack.ok) {
          throw new Error(ack.error ?? 'Nu s-a putut selecta cazul')
        }

        // Update local state (in case server has not emitted lobby:state yet)
        set((state) => ({
          isLoading: false,
          lobby: state.lobby ? { ...state.lobby, case: chosenCase } : null,
        }))
      } catch (err: unknown) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Eroare la selectarea cazului',
        })
      }
    },

    startGame: async () => {
      const { lobby } = get()
      if (!lobby) return

      set({ isLoading: true, error: null })
      try {
        const ack = await emitStartGame({})
        if (!ack.ok) {
          throw new Error(ack.error ?? 'Nu s-a putut porni jocul')
        }

        // Update local lobby status to playing
        set((state) => ({
          isLoading: false,
          lobby: state.lobby ? { ...state.lobby, status: 'playing' } : null,
        }))
      } catch (err: unknown) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Eroare la pornirea jocului',
        })
      }
    },

    leaveLobby: () => {
      disconnectLobbySocket()
      persistSession(null)
      set({
        session: null,
        lobby: null,
        error: null,
      })
    },

    clearError: () => set({ error: null }),

    setLobbyState: (lobby: LobbyState) => set({ lobby }),

    simulateAddPlayer: (playerName?: string) => {
      const { lobby } = get()
      if (!lobby) return

      const maxPlayers = lobby.case?.player_count ?? 4
      if (lobby.players.length >= maxPlayers) return

      const count = lobby.players.length + 1
      const defaultNames = [
        'Inspector Tudor',
        'Detectiv Andrei',
        'Comisar Radu',
        'Ofițer Ileana',
        'Sergent Matei',
      ]
      const name =
        playerName ?? defaultNames[(count - 2) % defaultNames.length] ?? `Detectiv #${count}`
      const newPlayer: Player = {
        id: `sim_player_${Date.now()}_${count}`,
        name,
        is_host: false,
        connected: true,
        location: null,
      }

      set((state) => ({
        lobby: state.lobby
          ? {
              ...state.lobby,
              players: [...state.lobby.players, newPlayer],
            }
          : null,
      }))
    },
  }
})

/** Helper hook to check if current player is host */
export function useIsHost(): boolean {
  const session = useLobbyStore((s) => s.session)
  const players = useLobbyStore((s) => s.lobby?.players)
  if (!session || !players) return false
  const current = players.find((p) => p.id === session.player_id)
  return current?.is_host ?? false
}

/** Helper hook to check if game can be started */
export function useCanStartGame(): { canStart: boolean; reason: string | null } {
  const lobby = useLobbyStore((s) => s.lobby)
  if (!lobby) {
    return { canStart: false, reason: 'Nu există o cameră activă' }
  }
  if (!lobby.case) {
    return { canStart: false, reason: 'Alegeți un caz înainte de a începe' }
  }
  const needed = lobby.case.player_count
  const current = lobby.players.length
  if (current < needed) {
    return {
      canStart: false,
      reason: `Sunt necesari ${needed} detectivi pentru acest caz (${current}/${needed} prezenți)`,
    }
  }
  return { canStart: true, reason: null }
}
