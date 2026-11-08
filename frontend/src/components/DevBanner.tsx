import { useLobbyStore } from '../stores/lobbyStore'

export function DevBanner() {
  const isMock = useLobbyStore((s) => s.isMock)
  const lobby = useLobbyStore((s) => s.lobby)
  const simulateAddPlayer = useLobbyStore((s) => s.simulateAddPlayer)

  if (!isMock || !lobby) return null

  const maxPlayers = lobby.case?.player_count ?? 4
  const isFull = lobby.players.length >= maxPlayers

  return (
    <aside className="dev-utility-bar" data-testid="dev-mock-banner">
      <div className="dev-utility-text">
        <span className="dev-tag">UTILITAR ARHIVĂ</span>
        <span>
          Mod simulare offline activ. Simulează prezența ofițerilor pentru a întruni numărul
          necesar:
        </span>
      </div>
      <button
        type="button"
        className="dev-utility-btn"
        disabled={isFull}
        onClick={() => simulateAddPlayer()}
        title={isFull ? 'Echipa este completă' : 'Simulează un nou ofițer prezent la secție'}
      >
        {isFull
          ? `✓ Echipă completă (${lobby.players.length}/${maxPlayers})`
          : `+ Simulează ofițer (${lobby.players.length}/${maxPlayers})`}
      </button>
    </aside>
  )
}
