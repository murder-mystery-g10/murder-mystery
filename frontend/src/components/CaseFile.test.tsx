import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BRIEFING } from '../test/fixtures'
import { CaseFile } from './CaseFile'

describe('CaseFile', () => {
  it('shows the briefing, the coroner report and the leads', () => {
    render(<CaseFile briefing={BRIEFING} caseTitle="Death at Vornicu Manor" onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'Death at Vornicu Manor' })
    expect(within(dialog).getByText('Matei Vornicu, 64')).toBeInTheDocument()
    expect(within(dialog).getByText(BRIEFING.when)).toBeInTheDocument()
    expect(within(dialog).getByText(BRIEFING.where)).toBeInTheDocument()
    expect(within(dialog).getByText(BRIEFING.summary)).toBeInTheDocument()
    expect(within(dialog).getByText(BRIEFING.victim.description)).toBeInTheDocument()
    expect(within(dialog).getByText(BRIEFING.discovery)).toBeInTheDocument()

    const report = within(dialog).getByRole('region', { name: 'Coroner’s report' })
    const lines = within(report)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(lines).toEqual(BRIEFING.coroner_report)

    expect(within(dialog).getByText('The greenhouse has a combination lock.')).toBeInTheDocument()
  })

  it('leaves out the leads and the age when the case has none', () => {
    render(
      <CaseFile
        briefing={{
          ...BRIEFING,
          victim: { ...BRIEFING.victim, age: null },
          story_hooks: undefined,
        }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Case file' })).toBeInTheDocument()
    expect(screen.getByText('Matei Vornicu')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Leads' })).not.toBeInTheDocument()
  })

  it('closes with the close button, Escape and a click outside', () => {
    const onClose = vi.fn()
    const { container } = render(<CaseFile briefing={BRIEFING} onClose={onClose} />)

    const closeButton = screen.getByRole('button', { name: 'Close the case file' })
    expect(closeButton).toHaveFocus()

    fireEvent.click(closeButton)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(container.querySelector('.casefile-overlay')!)
    expect(onClose).toHaveBeenCalledTimes(3)

    // A click inside the dialog does not close it.
    fireEvent.click(screen.getByText(BRIEFING.summary))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
