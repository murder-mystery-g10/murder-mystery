import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CaseSummary } from '../contracts/game-api'
import { CasePicker } from './CasePicker'

describe('CasePicker', () => {
  const mockCases: CaseSummary[] = [
    {
      case_id: 'vornicu_1926',
      title: 'Moarte la Conacul Vornicu',
      difficulty: 'normal',
      player_count: 4,
      summary: 'Matei Vornicu a fost găsit mort în bibliotecă.',
    },
    {
      case_id: 'ceasornicarul_1928',
      title: 'Ultimul Tic-Tac',
      difficulty: 'easy',
      player_count: 3,
      summary: 'Ceasornicarul a fost otrăvit în atelier.',
    },
  ]

  it('renders cases with titles and difficulty badges', () => {
    render(
      <CasePicker cases={mockCases} selectedCaseId={null} isHost={true} onSelectCase={vi.fn()} />,
    )

    expect(screen.getByText('Moarte la Conacul Vornicu')).toBeInTheDocument()
    expect(screen.getByText('Ultimul Tic-Tac')).toBeInTheDocument()
    expect(screen.getByText('Mediu')).toBeInTheDocument()
    expect(screen.getByText('Ușor')).toBeInTheDocument()
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

    expect(screen.getByText('✓ Dosar Selectat')).toBeInTheDocument()

    // Click on the second unselected case
    const secondCase = screen.getByText('Ultimul Tic-Tac')
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

    const firstCase = screen.getByText('Moarte la Conacul Vornicu')
    fireEvent.click(firstCase)

    expect(handleSelect).not.toHaveBeenCalled()
    expect(
      screen.getByText('Gazda analizează dosarele. În curând va fi selectat un caz...'),
    ).toBeInTheDocument()
  })
})
