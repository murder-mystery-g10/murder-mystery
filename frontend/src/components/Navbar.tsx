import { Link } from 'react-router'
import { isMockMode } from '../lib/mock'
import { useLobbyStore } from '../stores/lobbyStore'

export function Navbar() {
  const lobby = useLobbyStore((s) => s.lobby)
  const leaveLobby = useLobbyStore((s) => s.leaveLobby)

  return (
    <header className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <span className="navbar-monogram">✦</span>
          <div className="navbar-titles">
            <span className="navbar-main-title">TURDA POLICE PREFECTURE</span>
            <span className="navbar-sub-title">
              Judicial Bureau • Criminal Investigation • 1926
            </span>
          </div>
        </Link>

        <div className="navbar-actions">
          {isMockMode() && (
            <span className="dispatch-badge-mock" title="Local mode with simulated data">
              Archive Mode (Mock)
            </span>
          )}

          {lobby && (
            <button
              type="button"
              className="btn-text-action"
              onClick={leaveLobby}
              title="Leave the current investigation lobby"
            >
              Leave lobby
            </button>
          )}

          <Link to="/status" className="nav-link" title="Technical status of the services">
            System Status
          </Link>
        </div>
      </div>
    </header>
  )
}
