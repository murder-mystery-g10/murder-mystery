import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ack } from '../contracts/game-api'
import { emitEnterRoom } from '../lib/socket'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { makeSnapshot } from '../test/fixtures'
import { LobbyPage } from './LobbyPage'

vi.mock('../lib/socket', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/socket')>()),
  emitEnterRoom: vi.fn(),
}))

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
    vi.mocked(emitEnterRoom).mockReset()
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

    it('shows the player’s notebook and updates it when a snapshot arrives', () => {
      const snapshot = makeSnapshot()
      useLobbyStore.setState({ cases: [snapshot.lobby.case!] })
      useGameStore.getState().applySnapshot(snapshot)
      renderLobby(snapshot.lobby.code)

      const notebook = within(screen.getByRole('region', { name: 'Caiet de investigație' }))
      expect(notebook.getByText('Încă nu ai găsit niciun indiciu.')).toBeInTheDocument()

      act(() => {
        useGameStore.getState().applySnapshot({
          ...snapshot,
          notebook: [
            {
              id: 'B3',
              title: 'Flacon de medicament',
              icon: 'bottle',
              text: 'Un flacon cu dop alb.',
              room: 'library',
              found_by: snapshot.you,
            },
          ],
        })
      })

      expect(notebook.getByRole('heading', { name: 'Flacon de medicament' })).toBeInTheDocument()
      expect(notebook.getByText('Un flacon cu dop alb.')).toBeInTheDocument()
      expect(notebook.queryByText('Încă nu ai găsit niciun indiciu.')).not.toBeInTheDocument()
    })

    it('keeps the current room until the server accepts a destination', async () => {
      const snapshot = makeSnapshot()
      snapshot.theme = 'conac'
      snapshot.lobby.players[0].location = 'library'
      snapshot.rooms = [
        { room: 'library', yours: true, unlocked: true },
        { room: 'hall', yours: true, unlocked: true },
        { room: 'master_bedroom', yours: true, unlocked: false, lock: 'key' },
        { room: 'kitchen', yours: false, unlocked: true },
      ]
      useLobbyStore.setState({ cases: [snapshot.lobby.case!] })
      useGameStore.getState().applySnapshot(snapshot)
      renderLobby(snapshot.lobby.code)

      expect(screen.getByRole('img', { name: 'Bibliotecă' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Dormitorul principal (încuiată)' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Bucătărie' })).not.toBeInTheDocument()

      const enterRoom = vi.mocked(emitEnterRoom)
      enterRoom.mockResolvedValueOnce({ ok: false, error: 'The server refused entry.' })
      fireEvent.click(screen.getByRole('button', { name: 'Hol' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('The server refused entry.')
      expect(screen.getByRole('img', { name: 'Bibliotecă' })).toBeInTheDocument()

      let confirmEntry!: (ack: Ack) => void
      enterRoom.mockReturnValueOnce(new Promise((resolve) => (confirmEntry = resolve)))
      fireEvent.click(screen.getByRole('button', { name: 'Hol' }))
      expect(enterRoom).toHaveBeenLastCalledWith({ room: 'hall' })
      expect(screen.getByRole('img', { name: 'Bibliotecă' })).toBeInTheDocument()
      await act(async () => confirmEntry({ ok: true }))
      expect(screen.getByRole('img', { name: 'Hol' })).toBeInTheDocument()

      enterRoom.mockResolvedValueOnce({ ok: true })
      fireEvent.click(screen.getByRole('button', { name: 'Secția de poliție' }))
      expect(enterRoom).toHaveBeenLastCalledWith({ room: 'station' })
      expect(await screen.findByRole('img', { name: 'Secția de poliție' })).toBeInTheDocument()
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
  })
})
