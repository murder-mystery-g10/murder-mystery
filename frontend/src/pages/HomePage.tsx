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
          <div className="masthead-prefecture">REGATUL ROMÂNIEI • SECȚIA CRIMINALISTICĂ</div>
          <h1 className="masthead-title">Biroul de Anchetă</h1>
        </header>

        {error && (
          <div className="dispatch-alert dispatch-alert-error" role="alert">
            <span>{error}</span>
            <button type="button" className="alert-close-btn" onClick={clearError}>
              ✕
            </button>
          </div>
        )}

        <div className="registry-dockets-grid">
          {/* Create Docket */}
          <section className="docket-card">
            <div className="docket-top-stamp">DOSAR NOU • ȘEF DE ECHIPĂ</div>
            <h2 className="docket-title">Creează o investigație</h2>
            <p className="docket-desc">
              Deschide un nou dosar penal la secție și devino conducătorul anchetei operative.
            </p>

            <form onSubmit={handleCreate} className="dossier-form">
              <div className="form-field">
                <label htmlFor="create-name">Numele tău de detectiv</label>
                <input
                  id="create-name"
                  type="text"
                  maxLength={24}
                  required
                  placeholder="Ex: Comisar Popescu"
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
                {isLoading ? 'Se înregistrează...' : 'Creează camera'}
              </button>
            </form>
          </section>

          {/* Join Docket */}
          <section className="docket-card">
            <div className="docket-top-stamp">CONVOCARE TELEGRAFICĂ</div>
            <h2 className="docket-title">Alătură-te unei echipe</h2>
            <p className="docket-desc">
              Răspunde convocării primite de la conducătorul de anchetă pe baza codului de acces.
            </p>

            <form onSubmit={handleJoin} className="dossier-form">
              <div className="form-field">
                <label htmlFor="join-name">Numele tău de detectiv</label>
                <input
                  id="join-name"
                  type="text"
                  maxLength={24}
                  required
                  placeholder="Ex: Detectiv Ionescu"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  disabled={isLoading}
                  className="dossier-input"
                />
              </div>

              <div className="form-field">
                <label htmlFor="join-code">Codul camerei</label>
                <input
                  id="join-code"
                  type="text"
                  maxLength={10}
                  required
                  placeholder="Ex: CRIME1"
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
                {isLoading ? 'Se conectează...' : 'Intră în joc'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
