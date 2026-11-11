import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InterrogationScreen } from './InterrogationScreen'
import { makeSnapshot } from '../test/fixtures'
import { useGameStore } from '../stores/gameStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { socket } from '../lib/socket'
import * as socketLib from '../lib/socket'

vi.mock('../lib/useThemeMap', () => ({ useThemeMap: () => undefined }))
vi.mock('./SuspectPortrait', () => ({
  SuspectPortrait: ({ name, emotion }: { name: string; emotion: string }) => (
    <div role="img" aria-label={`${name}, ${emotion}`} />
  ),
}))

function event(name: string, payload: unknown) {
  // Deliver server events to the real singleton store subscriptions, without a second socket.
  act(() => {
    for (const listener of socket.listeners(name as 'interrogation:thinking'))
      listener(payload as never)
  })
}
function connectionEvent(connected: boolean) {
  const session = useLobbyStore.getState().session
  socket.auth = session
    ? { lobby_code: session.lobby_code, player_token: session.player_token }
    : {}
  socket.connected = connected
  event(connected ? 'connect' : 'disconnect', undefined)
}
function setup(connectBeforeMount = true) {
  const snapshot = makeSnapshot()
  snapshot.lobby.players[0].location = 'station'
  snapshot.interrogations = snapshot.suspects.map((suspect) => ({
    suspect: suspect.id,
    questions_left: 3,
    entries: [],
  }))
  snapshot.notebook = [
    {
      id: 'private',
      found_by: 'p1',
      title: 'Private clue',
      text: 'Unshared',
      room: 'hall',
      icon: 'key',
    },
  ]
  snapshot.board.items = [
    {
      id: 'pin',
      added_by: 'p2',
      kind: 'clue',
      ref: 'shared',
      x: 0,
      y: 0,
      clue: {
        id: 'shared',
        found_by: 'p2',
        title: 'Shared clue',
        text: 'Shared description',
        room: 'hall',
        icon: 'key',
      },
    },
  ]
  useGameStore.getState().applySnapshot(snapshot)
  useLobbyStore.setState({
    session: {
      lobby_code: snapshot.lobby.code,
      player_id: snapshot.you,
      player_token: 'test-token',
    },
  })
  if (connectBeforeMount) connectionEvent(true)
  render(<InterrogationScreen onReturnToStation={vi.fn()} />)
}
const answer = {
  entry: {
    id: 'entry-1',
    suspect: 'strat',
    asked_by: 'p2',
    question: 'Where were you?',
    evidence: null,
    answer: 'At home.',
    emotion: 'nervous' as const,
    intensity: 0.5,
  },
  questions_left: 2,
}

beforeEach(() => {
  useGameStore.getState().reset()
  useConnectionStore.getState().setConnected(false)
  vi.restoreAllMocks()
})
afterEach(() => {
  socket.connected = false
  useConnectionStore.getState().setConnected(false)
  useLobbyStore.setState({ session: null, lobby: null })
})
describe('interrogation', () => {
  it.each([true, false])(
    'tracks the shared socket when it connects before mount: %s, without visiting System Status',
    async (beforeMount) => {
      const send = vi.spyOn(socketLib, 'emitAsk').mockResolvedValue({ ok: true })
      setup(beforeMount)
      fireEvent.change(screen.getByLabelText('Your question'), {
        target: { value: 'Where were you?' },
      })
      if (!beforeMount) {
        expect(screen.getByText('Reconnect to continue the interrogation.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ask question' })).toBeDisabled()
        connectionEvent(true)
      }
      expect(screen.queryByText('Reconnect to continue the interrogation.')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ask question' })).toBeEnabled()
      connectionEvent(false)
      expect(screen.getByRole('button', { name: 'Ask question' })).toBeDisabled()
      connectionEvent(true)
      fireEvent.click(screen.getByRole('button', { name: 'Ask question' }))
      await waitFor(() =>
        expect(send).toHaveBeenCalledWith({
          suspect: 'strat',
          question: 'Where were you?',
          evidence: null,
        }),
      )
    },
  )

  it('does not treat an anonymous or different lobby connection as the active player session', () => {
    setup()
    socket.auth = {}
    event('connect', undefined)
    expect(useConnectionStore.getState().connected).toBe(true)
    expect(screen.getByText('Reconnect to continue the interrogation.')).toBeInTheDocument()
    act(() =>
      useLobbyStore.setState({
        session: { lobby_code: 'OTHER', player_id: 'p1', player_token: 'other-token' },
      }),
    )
    expect(screen.getByRole('button', { name: 'Ask question' })).toBeDisabled()
  })
  it('uses server counts and exposes only pinned clues; sends optional evidence using the contract', async () => {
    const send = vi.spyOn(socketLib, 'emitAsk').mockResolvedValue({ ok: true })
    setup()
    expect(screen.getByRole('option', { name: 'Shared clue' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Private clue' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask question' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: ' Where were you? ' },
    })
    fireEvent.change(screen.getByLabelText('Present board evidence (optional)'), {
      target: { value: 'shared' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }))
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({
        suspect: 'strat',
        question: 'Where were you?',
        evidence: 'shared',
      }),
    )
    expect(useGameStore.getState().snapshot?.interrogations[0].questions_left).toBe(3)
  })
  it('updates teammate history, portrait and counts; deduplicates answers and keeps histories across selection and snapshots', () => {
    setup()
    event('interrogation:thinking', { suspect: 'strat' })
    expect(screen.getByText('The suspect is thinking...')).toBeInTheDocument()
    event('interrogation:answer', answer)
    event('interrogation:answer', answer)
    expect(screen.getAllByText('At home.')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Dr. Ilie Strat, nervous' })).toBeInTheDocument()
    expect(screen.getByText('Detective Maria — Question')).toBeInTheDocument()
    expect(screen.getByText('2 questions remaining')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ana Mureșan/ }))
    expect(screen.queryByText('At home.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Dr. Ilie Strat/ }))
    expect(screen.getByText('At home.')).toBeInTheDocument()
    act(() => useGameStore.getState().applySnapshot(useGameStore.getState().snapshot!))
    expect(screen.getByText('At home.')).toBeInTheDocument()
  })
  it('shows exact refusal, clears waiting and preserves the counter', () => {
    setup()
    event('interrogation:thinking', { suspect: 'ana' })
    expect(screen.queryByText('The suspect is thinking...')).not.toBeInTheDocument()
    event('interrogation:thinking', { suspect: 'strat' })
    event('interrogation:unavailable', { suspect: 'strat', message: 'Different backend text' })
    expect(screen.getByRole('alert')).toHaveTextContent('The suspect refuses to talk right now.')
    expect(screen.queryByText('The suspect is thinking...')).not.toBeInTheDocument()
    expect(useGameStore.getState().snapshot?.interrogations[0].questions_left).toBe(3)
  })
  it('blocks duplicate submissions and exhaustion, and allows questions without evidence', async () => {
    let finish!: (value: { ok: boolean }) => void
    const send = vi.spyOn(socketLib, 'emitAsk').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    setup()
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Why?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }))
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({ suspect: 'strat', question: 'Why?', evidence: null })
    event('interrogation:answer', { ...answer, questions_left: 0 })
    await act(async () => {
      finish({ ok: true })
    })
    expect(screen.getByText('The team has no questions left for this suspect.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask question' })).toBeDisabled()
  })
})
