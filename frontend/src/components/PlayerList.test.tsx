import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Player } from '../contracts/game-api'
import { PlayerList } from './PlayerList'

describe('PlayerList', () => {
  const mockPlayers: Player[] = [
    {
      id: 'p1',
      name: 'Inspector Vasile',
      is_host: true,
      connected: true,
      location: null,
    },
    {
      id: 'p2',
      name: 'Detective Elena',
      is_host: false,
      connected: false,
      location: null,
    },
  ]

  it('renders all players and indicates host', () => {
    render(<PlayerList players={mockPlayers} currentUserId="p2" requiredCount={4} />)

    expect(screen.getByText('Inspector Vasile')).toBeInTheDocument()
    expect(screen.getByText('Detective Elena')).toBeInTheDocument()
    expect(screen.getByText('Host')).toBeInTheDocument()
    expect(screen.getByText('(You)')).toBeInTheDocument()
    expect(screen.getByText('2/4')).toBeInTheDocument()
  })
})
