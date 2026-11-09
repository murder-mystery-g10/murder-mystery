import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as socketLib from '../lib/socket'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { makeSnapshot, SUSPECTS } from '../test/fixtures'
import { AccusationDialog } from './AccusationDialog'

describe('AccusationDialog', () => {
  beforeEach(() => {
    useLobbyStore.getState().leaveLobby()
    useGameStore.getState().reset()
    vi.clearAllMocks()
  })

  it('renders nothing when accusationModalOpen is false', () => {
    useGameStore.setState({ accusationModalOpen: false })
    const { container } = render(<AccusationDialog />)
    expect(container.firstChild).toBeNull()
  })

  it('renders formulation form when modal is open and no proposal exists', () => {
    useGameStore.getState().applySnapshot(makeSnapshot())
    useGameStore.setState({ accusationModalOpen: true, accusation: null })

    render(<AccusationDialog />)

    expect(screen.getByText('Formulate the Accusation')).toBeInTheDocument()
    expect(screen.getByText('1. The Culprit (Suspect)')).toBeInTheDocument()
    expect(screen.getByText(SUSPECTS[0].name)).toBeInTheDocument()
    expect(screen.getByText('2. The Motive')).toBeInTheDocument()
    expect(screen.getByText('3. The Method')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Propose Accusation to Team/i })).toBeDisabled()
  })

  it('enables the submit button once all 3 choices are selected and calls emitProposeAccusation', () => {
    const emitSpy = vi.spyOn(socketLib, 'emitProposeAccusation').mockResolvedValue({ ok: true })

    useGameStore.getState().applySnapshot(makeSnapshot())
    useGameStore.setState({ accusationModalOpen: true, accusation: null })

    render(<AccusationDialog />)

    // Select culprit
    fireEvent.click(screen.getByText(SUSPECTS[0].name))
    // Select motive
    fireEvent.click(
      screen.getByText(/He was taking money from the charity hospital to save his sanatorium./i),
    )
    // Select method
    fireEvent.click(screen.getByText(/Pure digitoxin in a bottle identical to the heart drops./i))

    const submitBtn = screen.getByRole('button', { name: /Propose Accusation to Team/i })
    expect(submitBtn).toBeEnabled()

    fireEvent.click(submitBtn)
    expect(emitSpy).toHaveBeenCalledWith({
      culprit: 'strat',
      motive: 'motive_hospital',
      method: 'method_bottle_swap',
    })
  })

  it('renders voting mode when an accusation proposal is active', () => {
    const emitSpy = vi.spyOn(socketLib, 'emitVoteAccusation').mockResolvedValue({ ok: true })

    const snapshot = makeSnapshot()
    useLobbyStore.setState({
      session: { lobby_code: 'CASE01', player_id: 'p1', player_token: 'tok' },
    })
    useGameStore.getState().applySnapshot(snapshot)
    useGameStore.setState({
      accusationModalOpen: true,
      accusation: {
        id: 'prop-1',
        proposed_by: 'p2',
        choices: {
          culprit: 'strat',
          motive: 'motive_hospital',
          method: 'method_bottle_swap',
        },
        votes: { p2: true },
      },
    })

    render(<AccusationDialog />)

    expect(screen.getByText('Accusation Under Deliberation')).toBeInTheDocument()
    expect(screen.getAllByText(/Detective Maria/i).length).toBeGreaterThanOrEqual(1) // proposer & votes
    expect(screen.getByText(/Approve & Sign Warrant/i)).toBeInTheDocument()
    expect(screen.getByText(/Reject Accusation/i)).toBeInTheDocument()

    // Current player votes approve
    fireEvent.click(screen.getByRole('button', { name: /Approve & Sign Warrant/i }))
    expect(emitSpy).toHaveBeenCalledWith({
      proposal: 'prop-1',
      accept: true,
    })
  })
})
