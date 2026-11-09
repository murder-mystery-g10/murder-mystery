import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { GAME_RESULT, makeSnapshot } from '../test/fixtures'
import { LobbyPage } from './LobbyPage'

function renderLobby(code: string) {
  render(
    <MemoryRouter initialEntries={[`/lobby/${code}`]}>
      <Routes>
        <Route path="/lobby/:code" element={<LobbyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LobbyPage', () => {
  beforeEach(() => {
    useLobbyStore.getState().leaveLobby()
    useLobbyStore.setState({ cases: [] })
    useGameStore.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('renders direct join form if not joined yet', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    renderLobby('TEST99')

    expect(screen.getByText('Join the investigation')).toBeInTheDocument()
    expect(screen.getByText(/TEST99/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter lobby' })).toBeInTheDocument()
  })

  describe('in mock mode', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_MOCK', 'true')
    })

    it('renders the lobby room with code badge, detectives and the mock banner', async () => {
      await useLobbyStore.getState().createLobby('Inspector Moldovan')
      const code = useLobbyStore.getState().lobby!.code

      renderLobby(code)

      expect(screen.getByText('Station Waiting Room')).toBeInTheDocument()
      expect(screen.getByTestId('lobby-code-display')).toHaveTextContent(code)
      expect(screen.getByText('Inspector Moldovan')).toBeInTheDocument()
      expect(screen.getByText('Death at Vornicu Manor')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Start investigation/ })).toBeDisabled()
      expect(screen.getByTestId('dev-mock-banner')).toBeInTheDocument()
    })
  })

  describe('without mock mode', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_MOCK', 'false')
    })

    it('hides the mock banner and shows a backend error loading the cases', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ detail: 'Not implemented yet' }, { status: 501 })),
      )
      useLobbyStore.setState({
        session: { lobby_code: 'REAL01', player_id: 'p1', player_token: 't1' },
        lobby: {
          code: 'REAL01',
          status: 'waiting',
          solo: false,
          players: [
            { id: 'p1', name: 'Inspector Real', is_host: true, connected: true, location: null },
          ],
          case: null,
        },
      })

      renderLobby('REAL01')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not load the case library. The server does not support this yet.',
      )
      expect(screen.queryByTestId('dev-mock-banner')).not.toBeInTheDocument()
      expect(screen.queryByText('Death at Vornicu Manor')).not.toBeInTheDocument()
    })

    it('renders accusation button when playing', () => {
      useLobbyStore.setState({
        session: { lobby_code: 'PLAY01', player_id: 'p1', player_token: 't1' },
        lobby: {
          code: 'PLAY01',
          status: 'playing',
          solo: false,
          players: [
            { id: 'p1', name: 'Inspector Real', is_host: true, connected: true, location: null },
          ],
          case: null,
        },
      })

      renderLobby('PLAY01')

      expect(screen.getByRole('button', { name: /Formulate Accusation/i })).toBeInTheDocument()
    })

    it('renders end screen directly when gameResult is set', () => {
      useLobbyStore.setState({
        session: { lobby_code: 'FIN01', player_id: 'p1', player_token: 't1' },
        lobby: {
          code: 'FIN01',
          status: 'finished',
          solo: false,
          players: [
            { id: 'p1', name: 'Inspector Real', is_host: true, connected: true, location: null },
          ],
          case: null,
        },
      })
      useGameStore.getState().applySnapshot({
        ...makeSnapshot(),
        lobby: {
          code: 'FIN01',
          status: 'finished',
          solo: false,
          players: [
            { id: 'p1', name: 'Inspector Real', is_host: true, connected: true, location: null },
          ],
          case: null,
        },
        result: GAME_RESULT,
      })

      renderLobby('FIN01')

      expect(screen.getByText(/JUDICIAL BUREAU VERDICT/i)).toBeInTheDocument()
      expect(screen.getByText('TOTAL SCORE')).toBeInTheDocument()
    })
  })
})
