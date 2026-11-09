import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Navbar } from '../components/Navbar'
import { useLobbyStore } from '../stores/lobbyStore'

export function HomePage() {
  const navigate = useNavigate()
  const { createLobby, joinLobby, isLoading, error, clearError } = useLobbyStore()

  // Create lobby form state
  const [createName, setCreateName] = useState('')

  // Join lobby form state
  const [joinName, setJoinName] = useState('')
  const [joinCode, setJoinCode] = useState('')

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) return

    clearError()
    try {
      await createLobby(createName.trim())
      const currentCode = useLobbyStore.getState().lobby?.code
      if (currentCode) {
        navigate(`/lobby/${currentCode}`)
      }
    } catch {
      // Error handled in store
    }
  }

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault()
    if (!joinName.trim() || !joinCode.trim()) return

    clearError()
    try {
      await joinLobby(joinCode.trim().toUpperCase(), joinName.trim())
      const currentCode = useLobbyStore.getState().lobby?.code
      if (currentCode) {
        navigate(`/lobby/${currentCode}`)
      }
    } catch {
      // Error handled in store
    }
  }

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="desk-container">
        <header className="registry-masthead">
          <div className="masthead-prefecture">
            KINGDOM OF ROMANIA • CRIMINAL INVESTIGATION DIVISION
          </div>
          <h1 className="masthead-title">Investigation Bureau</h1>
        </header>

        {error && (
          <div className="dispatch-alert dispatch-alert-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="alert-close-btn"
              onClick={clearError}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <div className="registry-dockets-grid">
          {/* Create Docket */}
          <section className="docket-card">
            <div className="docket-top-stamp">NEW CASE FILE • TEAM LEADER</div>
            <h2 className="docket-title">Create an investigation</h2>
            <p className="docket-desc">
              Open a new criminal case file at the station and lead the investigation.
            </p>

            <form onSubmit={handleCreate} className="dossier-form">
              <div className="form-field">
                <label htmlFor="create-name">Your detective name</label>
                <input
                  id="create-name"
                  type="text"
                  maxLength={24}
                  required
                  placeholder="e.g. Inspector Popescu"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={isLoading}
                  className="dossier-input"
                />
              </div>

              <button
                type="submit"
                className="btn-order btn-order-primary btn-block"
                disabled={isLoading || !createName.trim()}
              >
                {isLoading ? 'Registering...' : 'Create lobby'}
              </button>
            </form>
          </section>

          {/* Join Docket */}
          <section className="docket-card">
            <div className="docket-top-stamp">TELEGRAPH SUMMONS</div>
            <h2 className="docket-title">Join a team</h2>
            <p className="docket-desc">
              Answer the lead investigator's summons with the lobby code you received.
            </p>

            <form onSubmit={handleJoin} className="dossier-form">
              <div className="form-field">
                <label htmlFor="join-name">Your detective name</label>
                <input
                  id="join-name"
                  type="text"
                  maxLength={24}
                  required
                  placeholder="e.g. Detective Ionescu"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  disabled={isLoading}
                  className="dossier-input"
                />
              </div>

              <div className="form-field">
                <label htmlFor="join-code">Lobby code</label>
                <input
                  id="join-code"
                  type="text"
                  maxLength={10}
                  required
                  placeholder="e.g. CRIME1"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="dossier-input input-code"
                />
              </div>

              <button
                type="submit"
                className="btn-order btn-order-secondary btn-block"
                disabled={isLoading || !joinName.trim() || !joinCode.trim()}
              >
                {isLoading ? 'Connecting...' : 'Join game'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
