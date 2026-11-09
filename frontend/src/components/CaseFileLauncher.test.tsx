import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { makeSnapshot } from '../test/fixtures'
import { Navbar } from './Navbar'

function renderNavbar() {
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  )
}

describe('Case file in the navbar', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    useLobbyStore.getState().leaveLobby()
    useGameStore.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is hidden before the game starts', () => {
    renderNavbar()
    expect(screen.queryByRole('button', { name: 'Case file' })).not.toBeInTheDocument()
  })

  it('opens and closes the case file once the snapshot has arrived', () => {
    useGameStore.getState().applySnapshot(makeSnapshot())
    renderNavbar()

    fireEvent.click(screen.getByRole('button', { name: 'Case file' }))
    expect(screen.getByRole('dialog', { name: 'Death at Vornicu Manor' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close the case file' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
