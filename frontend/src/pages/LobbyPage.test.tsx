import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import themeMap from '../../../themes/conac/map.json'
import type { Ack, ClueCard, InspectAck } from '../contracts/game-api'
import { emitEnterRoom, emitInspectObject, emitUnlockRoom, socket } from '../lib/socket'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { GAME_RESULT, makeSnapshot } from '../test/fixtures'
import { LobbyPage } from './LobbyPage'

vi.mock('../lib/socket', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/socket')>()),
  emitEnterRoom: vi.fn(),
  emitInspectObject: vi.fn(),
  emitUnlockRoom: vi.fn(),
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
    // jsdom exposes the dialog element without its modal methods.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true
    }
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false
    }
    useLobbyStore.getState().leaveLobby()
    useLobbyStore.setState({ cases: [] })
    useGameStore.getState().reset()
    vi.mocked(emitEnterRoom).mockReset()
    vi.mocked(emitInspectObject).mockReset()
    vi.mocked(emitUnlockRoom).mockReset()
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
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(themeMap)),
      )
    })

    it('shows the player’s notebook and updates it when a snapshot arrives', async () => {
      const snapshot = makeSnapshot()
      snapshot.theme = 'conac'
      useLobbyStore.setState({ cases: [snapshot.lobby.case!] })
      useGameStore.getState().applySnapshot(snapshot)
      renderLobby(snapshot.lobby.code)

      const notebook = within(screen.getByRole('region', { name: 'Investigation notebook' }))
      expect(notebook.getByText('No clues found yet.')).toBeInTheDocument()

      await act(async () => {
        useGameStore.getState().applySnapshot({
          ...snapshot,
          notebook: [
            {
              id: 'B3',
              title: 'Medicine bottle',
              icon: 'bottle',
              text: 'A bottle with a white stopper.',
              room: 'library',
              found_by: snapshot.you,
            },
          ],
        })
      })

      const entry = notebook.getByRole('button', { name: 'Medicine bottle' })
      expect(notebook.queryByText('A bottle with a white stopper.')).not.toBeInTheDocument()
      expect(notebook.queryByText('No clues found yet.')).not.toBeInTheDocument()

      entry.focus()
      fireEvent.click(entry)
      const details = within(screen.getByRole('dialog', { name: 'Medicine bottle' }))
      expect(details.getByText('A bottle with a white stopper.')).toBeInTheDocument()
      fireEvent.click(details.getByRole('button', { name: 'Close details' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(entry).toHaveFocus()
    })

    it('displays object inspection replies and saves each discovered clue once', async () => {
      const snapshot = makeSnapshot()
      snapshot.theme = 'conac'
      snapshot.lobby.players[0].location = 'library'
      snapshot.rooms = [{ room: 'library', yours: true, unlocked: true }]
      useLobbyStore.setState({ cases: [snapshot.lobby.case!] })
      useGameStore.getState().applySnapshot(snapshot)
      renderLobby(snapshot.lobby.code)

      const clue: ClueCard = {
        id: 'B3',
        title: 'Heart-drop bottle',
        text: 'A bottle with a white stopper.',
        icon: 'bottle',
        room: 'library',
        found_by: snapshot.you,
      }
      const inspect = vi.mocked(emitInspectObject)
      inspect.mockResolvedValue({ ok: true, clues: [clue] })
      const bottle = await screen.findByRole('button', { name: 'Medicine bottle' })
      const notebook = within(screen.getByRole('region', { name: 'Investigation notebook' }))

      fireEvent.click(bottle)
      const result = within(screen.getByRole('dialog', { name: 'Medicine bottle' }))
      expect(await result.findByText(clue.text)).toBeInTheDocument()
      expect(inspect).toHaveBeenLastCalledWith({ object: 'library.medicine_bottle' })
      expect(notebook.getByRole('button', { name: clue.title })).toBeInTheDocument()
      fireEvent.click(result.getByRole('button', { name: 'Close details' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await act(async () => fireEvent.keyDown(bottle, { key: 'Enter' }))
      expect(inspect).toHaveBeenCalledTimes(2)
      expect(notebook.getAllByRole('button', { name: clue.title })).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Close details' }))

      inspect.mockResolvedValueOnce({ ok: true, text: 'The clock has stopped.' })
      const clock = screen.getByRole('button', { name: 'Clock' })
      fireEvent.click(clock)
      expect(await screen.findByText('The clock has stopped.')).toBeInTheDocument()
      expect(notebook.getAllByRole('listitem')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Close details' }))

      inspect.mockResolvedValueOnce({ ok: true })
      fireEvent.click(clock)
      expect(await screen.findByText('Nothing of interest.')).toBeInTheDocument()
      expect(notebook.getAllByRole('listitem')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Close details' }))

      let reply!: (ack: InspectAck) => void
      inspect.mockReturnValueOnce(new Promise((resolve) => (reply = resolve)))
      fireEvent.click(clock)
      expect(screen.getByText('Inspecting the object…')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
      await act(async () => reply({ ok: true, text: 'The clock has stopped.' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

      expect(screen.getByRole('img', { name: 'Library' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Master bedroom (locked)' })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
      expect(screen.queryByRole('button', { name: 'Kitchen' })).not.toBeInTheDocument()

      const enterRoom = vi.mocked(emitEnterRoom)
      enterRoom.mockResolvedValueOnce({ ok: false, error: 'The server refused entry.' })
      fireEvent.click(screen.getByRole('button', { name: 'Hall' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('The server refused entry.')
      expect(screen.getByRole('img', { name: 'Library' })).toBeInTheDocument()

      let confirmEntry!: (ack: Ack) => void
      enterRoom.mockReturnValueOnce(new Promise((resolve) => (confirmEntry = resolve)))
      fireEvent.click(screen.getByRole('button', { name: 'Hall' }))
      expect(enterRoom).toHaveBeenLastCalledWith({ room: 'hall' })
      expect(screen.getByRole('img', { name: 'Library' })).toBeInTheDocument()
      await act(async () => confirmEntry({ ok: true }))
      expect(screen.getByRole('img', { name: 'Hall' })).toBeInTheDocument()

      enterRoom.mockResolvedValueOnce({ ok: true })
      fireEvent.click(screen.getByRole('button', { name: 'Police station' }))
      expect(enterRoom).toHaveBeenLastCalledWith({ room: 'station' })
      expect(await screen.findByRole('img', { name: 'Police station' })).toBeInTheDocument()
    })

    it('shows live locations and restores the notebook and room from a reconnect snapshot', async () => {
      const snapshot = makeSnapshot()
      snapshot.theme = themeMap.theme_id
      const player = { ...snapshot.lobby.players[0], location: 'library' }
      const peer = {
        id: 'p2',
        name: 'Detective Stoica',
        is_host: false,
        connected: true,
        location: 'hall',
      }
      snapshot.lobby.players = [player, peer]
      snapshot.rooms = [
        { room: 'library', yours: true, unlocked: true },
        { room: 'hall', yours: true, unlocked: true },
      ]
      useLobbyStore.setState({ cases: [snapshot.lobby.case!] })
      useGameStore.getState().applySnapshot(snapshot)
      renderLobby(snapshot.lobby.code)

      const presence = within(screen.getByRole('region', { name: 'Detectives' }))
      expect(presence.getByText('(You)')).toBeInTheDocument()
      expect(presence.getByText('Detective Stoica')).toBeInTheDocument()
      expect(presence.getByText('Hall')).toBeInTheDocument()

      let confirmEntry!: (ack: Ack) => void
      vi.mocked(emitEnterRoom).mockReturnValueOnce(
        new Promise((resolve) => (confirmEntry = resolve)),
      )
      fireEvent.click(screen.getByRole('button', { name: 'Hall' }))
      await act(async () => {
        for (const handler of socket.listeners('presence:update')) {
          handler({
            players: [
              { ...player, location: 'station' },
              { ...peer, connected: false, location: 'kitchen' },
            ],
          })
        }
        confirmEntry({ ok: true })
      })
      expect(presence.getByText('Offline · Kitchen')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Police station' })).toBeInTheDocument()

      act(() => {
        for (const handler of socket.listeners('game:snapshot')) {
          handler({
            ...snapshot,
            lobby: { ...snapshot.lobby, players: [{ ...player, location: 'hall' }, peer] },
            notebook: [
              {
                id: 'B3',
                title: 'Heart-drop bottle',
                text: 'A bottle with a white stopper.',
                icon: 'bottle',
                room: 'library',
                found_by: snapshot.you,
              },
            ],
          })
        }
      })
      expect(screen.getByRole('img', { name: 'Hall' })).toBeInTheDocument()
      expect(presence.queryByText('Offline · Kitchen')).not.toBeInTheDocument()
      const notebook = within(screen.getByRole('region', { name: 'Investigation notebook' }))
      expect(notebook.getByText('Heart-drop bottle')).toBeInTheDocument()
    })

    it('offers only discovered keys and lets the player enter separately after unlocking', async () => {
      const snapshot = makeSnapshot()
      snapshot.theme = 'conac'
      snapshot.lobby.players[0].location = 'library'
      snapshot.rooms = [{ room: 'master_bedroom', yours: true, unlocked: false, lock: 'key' }]
      useLobbyStore.setState({ cases: [snapshot.lobby.case!] })
      useGameStore.getState().applySnapshot(snapshot)
      renderLobby(snapshot.lobby.code)

      fireEvent.click(screen.getByRole('button', { name: 'Master bedroom (locked)' }))
      const form = within(screen.getByRole('form', { name: 'Unlock Master bedroom' }))
      expect(form.getByText('You have not found a key yet.')).toBeInTheDocument()
      expect(form.getByRole('button', { name: 'Unlock' })).toBeDisabled()

      const key: ClueCard = {
        id: 'B5',
        title: 'Master bedroom key',
        text: 'Found under the armchair.',
        icon: 'key',
        room: 'library',
        found_by: snapshot.you,
      }
      await act(async () => {
        useGameStore.getState().applySnapshot({
          ...snapshot,
          notebook: [key, { ...key, id: 'B3', title: 'Medicine bottle', icon: 'bottle' }],
        })
      })
      expect(form.queryByRole('option', { name: 'Medicine bottle' })).not.toBeInTheDocument()
      fireEvent.change(form.getByLabelText('Key from your notebook'), { target: { value: key.id } })
      vi.mocked(emitUnlockRoom).mockResolvedValueOnce({ ok: true })
      await act(async () => fireEvent.click(form.getByRole('button', { name: 'Unlock' })))

      expect(emitUnlockRoom).toHaveBeenCalledWith({ room: 'master_bedroom', key_clue: 'B5' })
      const openRoom = await screen.findByRole('button', { name: 'Master bedroom' })
      expect(emitEnterRoom).not.toHaveBeenCalled()
      expect(screen.getByRole('img', { name: 'Library' })).toBeInTheDocument()

      vi.mocked(emitEnterRoom).mockResolvedValueOnce({ ok: true })
      fireEvent.click(openRoom)
      expect(await screen.findByRole('img', { name: 'Master bedroom' })).toBeInTheDocument()
    })

    it('preserves leading zeroes in codes and reacts when another player opens the room', async () => {
      const snapshot = makeSnapshot()
      snapshot.theme = 'conac'
      snapshot.lobby.players[0].location = 'library'
      snapshot.rooms = [{ room: 'greenhouse', yours: true, unlocked: false, lock: 'code' }]
      useLobbyStore.setState({ cases: [snapshot.lobby.case!] })
      useGameStore.getState().applySnapshot(snapshot)
      renderLobby(snapshot.lobby.code)

      fireEvent.click(screen.getByRole('button', { name: 'Greenhouse (locked)' }))
      const form = within(screen.getByRole('form', { name: 'Unlock Greenhouse' }))
      fireEvent.change(form.getByLabelText('Code'), { target: { value: ' 0427 ' } })
      vi.mocked(emitUnlockRoom).mockResolvedValueOnce({ ok: false, error: 'Wrong code.' })
      fireEvent.click(form.getByRole('button', { name: 'Unlock' }))
      expect(emitUnlockRoom).toHaveBeenCalledWith({ room: 'greenhouse', code: '0427' })
      expect(await form.findByRole('alert')).toHaveTextContent('Wrong code.')
      expect(screen.getByRole('button', { name: 'Greenhouse (locked)' })).toBeInTheDocument()

      act(() => {
        for (const handler of socket.listeners('room:unlocked')) {
          handler({ room: 'greenhouse', by: 'p2' })
        }
      })
      expect(screen.queryByRole('form', { name: 'Unlock Greenhouse' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Greenhouse' })).toBeEnabled()
      expect(screen.getByRole('img', { name: 'Library' })).toBeInTheDocument()
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
