import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { GAME_RESULT, makeSnapshot } from '../test/fixtures'
import { EndScreen } from './EndScreen'

describe('EndScreen', () => {
  beforeEach(() => {
    useLobbyStore.getState().leaveLobby()
    useGameStore.getState().reset()
  })

  it('renders nothing when gameResult is null', () => {
    useGameStore.setState({ gameResult: null })
    const { container } = render(<EndScreen />)
    expect(container.firstChild).toBeNull()
  })

  it('renders score breakdown, reveal story, and missed clues', () => {
    useGameStore.getState().applySnapshot(makeSnapshot())
    useGameStore.setState({ gameResult: GAME_RESULT })

    render(<EndScreen />)

    expect(screen.getByText(/Case Solved: Justice Prevails/i)).toBeInTheDocument()
    expect(screen.getByText('1160')).toBeInTheDocument()
    expect(screen.getByText('+500 pts')).toBeInTheDocument()
    expect(screen.getAllByText('+250 pts')).toHaveLength(2)
    expect(screen.getByText('+100 pts')).toBeInTheDocument()
    expect(screen.getByText('+60 pts')).toBeInTheDocument()

    // Accusation vs Verdict
    expect(screen.getByText(/THE CULPRIT/i)).toBeInTheDocument()
    expect(screen.getByText(/THE MOTIVE/i)).toBeInTheDocument()
    expect(screen.getByText(/THE METHOD/i)).toBeInTheDocument()

    // Reveal story
    expect(screen.getByText(GAME_RESULT.reveal)).toBeInTheDocument()

    // Missed clues
    expect(screen.getByText('Keys below the armchair')).toBeInTheDocument()
    expect(screen.getByText(/A set of brass keys hidden under the cushion./i)).toBeInTheDocument()
  })

  it('triggers leaveLobby when Return button is clicked', () => {
    const leaveSpy = vi.spyOn(useLobbyStore.getState(), 'leaveLobby')

    useGameStore.getState().applySnapshot(makeSnapshot())
    useGameStore.setState({ gameResult: GAME_RESULT })

    render(<EndScreen />)

    const returnBtn = screen.getByRole('button', {
      name: /Return to Police Bureau Registry/i,
    })
    fireEvent.click(returnBtn)
    expect(leaveSpy).toHaveBeenCalled()
  })
})
