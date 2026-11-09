import { isMockMode } from '../lib/mock'
import { useLobbyStore } from '../stores/lobbyStore'

export function DevBanner() {
  const lobby = useLobbyStore((s) => s.lobby)
  const simulateAddPlayer = useLobbyStore((s) => s.simulateAddPlayer)

  if (!isMockMode() || !lobby) return null

  const maxPlayers = lobby.case?.player_count ?? 4
  const isFull = lobby.players.length >= maxPlayers

  return (
    <aside className="dev-utility-bar" data-testid="dev-mock-banner">
      <div className="dev-utility-text">
        <span className="dev-tag">ARCHIVE TOOL</span>
        <span>Offline mock mode is on. Add simulated officers to reach the required number:</span>
      </div>
      <button
        type="button"
        className="dev-utility-btn"
        disabled={isFull}
        onClick={() => simulateAddPlayer()}
        title={isFull ? 'The team is complete' : 'Add a simulated officer to the station'}
      >
        {isFull
          ? `✓ Team complete (${lobby.players.length}/${maxPlayers})`
          : `+ Add simulated officer (${lobby.players.length}/${maxPlayers})`}
      </button>
    </aside>
  )
}
