import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../stores/gameStore'
import { makeSnapshot } from '../test/fixtures'
import { InvestigationBoard } from './InvestigationBoard'

beforeAll(() => {
  // React Flow measures its canvas; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

function setup() {
  const snapshot = makeSnapshot()
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
        title: 'Clue found by a teammate',
        text: 'Shared description',
        room: 'hall',
        icon: 'key',
      },
    },
  ]
  useGameStore.getState().applySnapshot(snapshot)
  const pinBoardItem = vi.fn().mockResolvedValue({ ok: true })
  useGameStore.setState({ pinBoardItem })
  render(<InvestigationBoard onReturnToStation={vi.fn()} />)
  return { pinBoardItem }
}

describe('InvestigationBoard', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    useGameStore.getState().reset()
  })

  it('shows a clue pinned by a teammate from its card on the board', () => {
    setup()
    expect(screen.getAllByText('Clue found by a teammate').length).toBeGreaterThan(0)
    expect(screen.queryByText('Unavailable evidence')).not.toBeInTheDocument()
  })

  it('pins a suspect on the shared board', async () => {
    const { pinBoardItem } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Dr\. Ilie Strat/ }))
    await waitFor(() =>
      expect(pinBoardItem).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'suspect', ref: 'strat' }),
      ),
    )
  })

  it('shows the server refusal when a pin fails', async () => {
    const { pinBoardItem } = setup()
    pinBoardItem.mockResolvedValue({ ok: false, error: 'Go to the police station first.' })
    fireEvent.click(screen.getByRole('button', { name: /Dr\. Ilie Strat/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Go to the police station first.')
  })
})
