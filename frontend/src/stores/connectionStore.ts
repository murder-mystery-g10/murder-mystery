import { create } from 'zustand'

interface ConnectionState {
  connected: boolean
  /** Lobby authenticated by the current connection; anonymous diagnostics have none. */
  lobbyCode: string | null
  setConnected: (connected: boolean, lobbyCode?: string | null) => void
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  connected: false,
  lobbyCode: null,
  setConnected: (connected, lobbyCode = null) =>
    set({ connected, lobbyCode: connected ? lobbyCode : null }),
}))
