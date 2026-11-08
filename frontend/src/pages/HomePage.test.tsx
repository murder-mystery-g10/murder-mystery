import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLobbyStore } from '../stores/lobbyStore'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  beforeEach(() => {
    useLobbyStore.getState().leaveLobby()
  })

  it('renders landing cards for create and join', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Creează o investigație')).toBeInTheDocument()
    expect(screen.getByText('Alătură-te unei echipe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Creează camera' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Intră în joc' })).toBeInTheDocument()
  })

  it('disables submit button when required inputs are empty', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const createBtn = screen.getByRole('button', { name: 'Creează camera' })
    expect(createBtn).toBeDisabled()

    const joinBtn = screen.getByRole('button', { name: 'Intră în joc' })
    expect(joinBtn).toBeDisabled()
  })

  it('enables create button when player name is typed', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const input = screen.getByLabelText('Numele tău de detectiv', { selector: '#create-name' })
    fireEvent.change(input, { target: { value: 'Inspector Maigret' } })

    const createBtn = screen.getByRole('button', { name: 'Creează camera' })
    expect(createBtn).not.toBeDisabled()
  })
})
