import { Link } from 'react-router'
import { useLobbyStore } from '../stores/lobbyStore'

export function Navbar() {
  const lobby = useLobbyStore((s) => s.lobby)
  const isMock = useLobbyStore((s) => s.isMock)
  const leaveLobby = useLobbyStore((s) => s.leaveLobby)

  return (
    <header className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <span className="navbar-monogram">✦</span>
          <div className="navbar-titles">
            <span className="navbar-main-title">PREFECTURA POLIȚIEI TURDA</span>
            <span className="navbar-sub-title">Biroul Judiciar • Secția Criminalistică • 1926</span>
          </div>
        </Link>

        <div className="navbar-actions">
          {isMock && (
            <span className="dispatch-badge-mock" title="Mod de lucru local cu date simulate">
              Mod Arhivă (Mock)
            </span>
          )}

          {lobby && (
            <button
              type="button"
              className="btn-text-action"
              onClick={leaveLobby}
              title="Părăsește camera de anchetă curentă"
            >
              Părăsește camera
            </button>
          )}

          <Link to="/status" className="nav-link" title="Stare tehnică servicii">
            Stare Sistem
          </Link>
        </div>
      </div>
    </header>
  )
}
