import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLobbyStore } from '../stores/lobbyStore'
import { LobbyPage } from './LobbyPage'

describe('LobbyPage', () => {
  beforeEach(() => {
    useLobbyStore.getState().leaveLobby()
  })

  it('renders direct join form if not joined yet', () => {
    render(
      <MemoryRouter initialEntries={['/lobby/TEST99']}>
        <Routes>
          <Route path="/lobby/:code" element={<LobbyPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Intră în anchetă')).toBeInTheDocument()
    expect(screen.getByText(/TEST99/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Intră în cameră' })).toBeInTheDocument()
  })

  it('renders lobby room with code badge and detectives when active', async () => {
    await useLobbyStore.getState().createLobby('Comisar Moldovan')

    const code = useLobbyStore.getState().lobby!.code

    render(
      <MemoryRouter initialEntries={[`/lobby/${code}`]}>
        <Routes>
          <Route path="/lobby/:code" element={<LobbyPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Sala de Așteptare a Secției')).toBeInTheDocument()
    expect(screen.getByTestId('lobby-code-display')).toHaveTextContent(code)
    expect(screen.getByText('Comisar Moldovan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Începe investigația/ })).toBeDisabled()
  })
})
