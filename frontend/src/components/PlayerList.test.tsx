import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Player } from '../contracts/game-api'
import { PlayerList } from './PlayerList'

describe('PlayerList', () => {
  const mockPlayers: Player[] = [
    {
      id: 'p1',
      name: 'Comisar Vasile',
      is_host: true,
      connected: true,
      location: null,
    },
    {
      id: 'p2',
      name: 'Detectiv Elena',
      is_host: false,
      connected: false,
      location: null,
    },
  ]

  it('renders all players and indicates host', () => {
    render(<PlayerList players={mockPlayers} currentUserId="p2" requiredCount={4} />)

    expect(screen.getByText('Comisar Vasile')).toBeInTheDocument()
    expect(screen.getByText('Detectiv Elena')).toBeInTheDocument()
    expect(screen.getByText('Gazdă')).toBeInTheDocument()
    expect(screen.getByText('(Tu)')).toBeInTheDocument()
    expect(screen.getByText('2/4')).toBeInTheDocument()
  })
})
