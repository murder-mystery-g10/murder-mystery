import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLobbyStore } from '../stores/lobbyStore'
import { HomePage } from './HomePage'

function renderHome() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    useLobbyStore.getState().leaveLobby()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('renders landing cards for create and join', () => {
    renderHome()

    expect(screen.getByText('Create an investigation')).toBeInTheDocument()
    expect(screen.getByText('Join a team')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create lobby' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join game' })).toBeInTheDocument()
  })

  it('disables submit button when required inputs are empty', () => {
    renderHome()

    expect(screen.getByRole('button', { name: 'Create lobby' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Join game' })).toBeDisabled()
  })

  it('enables create button when player name is typed', () => {
    renderHome()

    const input = screen.getByLabelText('Your detective name', { selector: '#create-name' })
    fireEvent.change(input, { target: { value: 'Inspector Maigret' } })

    expect(screen.getByRole('button', { name: 'Create lobby' })).not.toBeDisabled()
  })

  it('shows the player a clear message when the backend rejects the lobby code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ detail: 'Lobby not found' }, { status: 404 })),
    )
    renderHome()

    fireEvent.change(screen.getByLabelText('Your detective name', { selector: '#join-name' }), {
      target: { value: 'Detective Ionescu' },
    })
    fireEvent.change(screen.getByLabelText('Lobby code'), { target: { value: 'nope42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join game' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No lobby with code NOPE42 exists. Check the code and try again.',
    )
    expect(useLobbyStore.getState().lobby).toBeNull()
  })

  it('shows the player a clear message when the server is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    renderHome()

    fireEvent.change(screen.getByLabelText('Your detective name', { selector: '#create-name' }), {
      target: { value: 'Inspector Popescu' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create lobby' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot reach the game server. Check your connection and try again.',
    )
  })
})
