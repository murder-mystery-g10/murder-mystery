import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CaseSummary } from '../contracts/game-api'
import { CasePicker } from './CasePicker'

describe('CasePicker', () => {
  const mockCases: CaseSummary[] = [
    {
      case_id: 'vornicu_1926',
      title: 'Death at Vornicu Manor',
      difficulty: 'normal',
      player_count: 4,
      summary: 'Matei Vornicu died in the manor library.',
    },
    {
      case_id: 'ceasornicarul_1928',
      title: 'The Last Tick',
      difficulty: 'easy',
      player_count: 3,
      summary: 'The watchmaker was poisoned in his workshop.',
    },
  ]

  it('renders cases with titles and difficulty badges', () => {
    render(
      <CasePicker cases={mockCases} selectedCaseId={null} isHost={true} onSelectCase={vi.fn()} />,
    )

    expect(screen.getByText('Death at Vornicu Manor')).toBeInTheDocument()
    expect(screen.getByText('The Last Tick')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Easy')).toBeInTheDocument()
  })

  it('allows host to select a case', () => {
    const handleSelect = vi.fn()
    render(
      <CasePicker
        cases={mockCases}
        selectedCaseId="vornicu_1926"
        isHost={true}
        onSelectCase={handleSelect}
      />,
    )

    expect(screen.getByText('✓ Case Selected')).toBeInTheDocument()

    // Click on the second unselected case
    const secondCase = screen.getByText('The Last Tick')
    fireEvent.click(secondCase)

    expect(handleSelect).toHaveBeenCalledWith('ceasornicarul_1928')
  })

  it('does not allow guest to select a case', () => {
    const handleSelect = vi.fn()
    render(
      <CasePicker
        cases={mockCases}
        selectedCaseId={null}
        isHost={false}
        onSelectCase={handleSelect}
      />,
    )

    const firstCase = screen.getByText('Death at Vornicu Manor')
    fireEvent.click(firstCase)

    expect(handleSelect).not.toHaveBeenCalled()
    expect(
      screen.getByText('The host is reviewing the case files. A case will be chosen soon...'),
    ).toBeInTheDocument()
  })
})
