import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { CasePicker } from '../components/CasePicker'
import { DevBanner } from '../components/DevBanner'
import { LobbyCodeBadge } from '../components/LobbyCodeBadge'
import { Navbar } from '../components/Navbar'
import { PlayerList } from '../components/PlayerList'
import { useCanStartGame, useIsHost, useLobbyStore } from '../stores/lobbyStore'

export function LobbyPage() {
  const { code } = useParams<{ code: string }>()
  const lobby = useLobbyStore((s) => s.lobby)
  const session = useLobbyStore((s) => s.session)
  const cases = useLobbyStore((s) => s.cases)
  const isLoading = useLobbyStore((s) => s.isLoading)
  const error = useLobbyStore((s) => s.error)
  const clearError = useLobbyStore((s) => s.clearError)
  const loadCases = useLobbyStore((s) => s.loadCases)
  const selectCase = useLobbyStore((s) => s.selectCase)
  const startGame = useLobbyStore((s) => s.startGame)
  const joinLobby = useLobbyStore((s) => s.joinLobby)

  const [directJoinName, setDirectJoinName] = useState('')

  const isHost = useIsHost()
  const { canStart, reason } = useCanStartGame()

  useEffect(() => {
    if (cases.length === 0) {
      loadCases()
    }
  }, [cases.length, loadCases])

  const handleDirectJoin = async (e: FormEvent) => {
    e.preventDefault()
    if (!directJoinName.trim() || !code) return
    clearError()
    try {
      await joinLobby(code.toUpperCase(), directJoinName.trim())
    } catch {
      // Handled in store
    }
  }

  // If there's no active session or lobby in memory, allow quick join directly
  if (!lobby) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <main className="desk-container" style={{ marginTop: '3.5rem' }}>
          <div className="dossier-entry-card" style={{ maxWidth: '460px', margin: '0 auto' }}>
            <div className="entry-card-header">
              <span className="entry-card-meta">REGISTRATURĂ PENALĂ</span>
              <h1 className="entry-card-title">Intră în anchetă</h1>
              <p className="entry-card-desc">
                Camera de investigație cu codul{' '}
                <strong className="text-brass">{code?.toUpperCase()}</strong>.
              </p>
            </div>

            {error && (
              <div className="dispatch-alert dispatch-alert-error" role="alert">
                <span>{error}</span>
                <button type="button" className="alert-close-btn" onClick={clearError}>
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleDirectJoin} className="dossier-form">
              <div className="form-field">
                <label htmlFor="direct-join-name">Numele tău de detectiv</label>
                <input
                  id="direct-join-name"
                  type="text"
                  maxLength={24}
                  required
                  placeholder="Ex: Inspector Georgescu"
                  value={directJoinName}
                  onChange={(e) => setDirectJoinName(e.target.value)}
                  disabled={isLoading}
                  className="dossier-input"
                />
              </div>

              <button
                type="submit"
                className="btn-order btn-order-primary btn-block"
                disabled={isLoading || !directJoinName.trim()}
              >
                {isLoading ? 'Se conectează...' : 'Intră în cameră'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link to="/" className="text-link-back">
                  ← Înapoi la registrul secției
                </Link>
              </div>
            </form>
          </div>
        </main>
      </div>
    )
  }

  // If game has started
  if (lobby.status === 'playing') {
    return (
      <div className="page-wrapper">
        <Navbar />
        <main className="desk-container">
          <div className="dispatch-warrant-card">
            <span className="warrant-seal">MANDAT JUDICIAR EXECUTORIU</span>
            <h1 className="warrant-title">Investigația a început!</h1>
            <p className="warrant-desc">
              Echipa de 4 detectivi a părăsit secția de poliție și a descins la Conacul Vornicu.
              Dosarul de urmărire penală:{' '}
              <strong className="text-cream">{lobby.case?.title ?? 'Dosar activ'}</strong>.
            </p>
            <div className="warrant-meta">
              <span className="warrant-note">
                Conacul a fost sigilat. Începeți explorarea încăperilor și interogatoriul
                suspecților.
              </span>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const hostPlayer = lobby.players.find((p) => p.is_host)

  return (
    <div className="page-wrapper">
      <Navbar />
      <DevBanner />

      <main className="desk-container">
        {error && (
          <div className="dispatch-alert dispatch-alert-error" role="alert">
            <span>{error}</span>
            <button type="button" className="alert-close-btn" onClick={clearError}>
              ✕
            </button>
          </div>
        )}

        <div className="desk-topbar">
          <div className="desk-case-ident">
            <div className="case-bulletin-tag">DOSAR PENAL • CONVOCARE OPERATIVĂ</div>
            <h1 className="desk-title">Sala de Așteptare a Secției</h1>
            <div className="desk-subtitle">
              Ofițerii desemnați se reunesc la secție. Conducătorul de anchetă examinează dosarul
              crimei.
            </div>
          </div>

          <LobbyCodeBadge code={lobby.code} />
        </div>

        <div className="desk-main-grid">
          {/* Left Column: Player Duty Roster */}
          <aside className="desk-roster-column">
            <PlayerList
              players={lobby.players}
              currentUserId={session?.player_id}
              requiredCount={lobby.case?.player_count}
            />
          </aside>

          {/* Right Column: Confidential Case Dossier */}
          <section className="desk-dossier-column">
            <CasePicker
              cases={cases}
              selectedCaseId={lobby.case?.case_id}
              isHost={isHost}
              isLoading={isLoading}
              onSelectCase={selectCase}
            />
          </section>
        </div>

        {/* Integrated Dispatch Order Bar */}
        <footer className="dispatch-order-bar">
          <div className="dispatch-order-status">
            {isHost ? (
              canStart ? (
                <span className="order-ready-status">
                  ✓ Toate condițiile sunt îndeplinite. Conducătorul poate da ordinul de deplasare la
                  conac.
                </span>
              ) : (
                <span className="order-waiting-status">{reason}</span>
              )
            ) : (
              <span className="order-guest-status">
                Așteptăm ca șeful de echipă ({hostPlayer?.name ?? 'Gazda'}) să finalizeze dosarul și
                să emită ordinul de deplasare...
              </span>
            )}
          </div>

          {isHost && (
            <button
              type="button"
              className="btn-order btn-order-primary"
              disabled={!canStart || isLoading}
              onClick={startGame}
              title={reason ?? 'Emite ordinul de începere a anchetei'}
            >
              {isLoading ? 'Se emite ordinul...' : 'Începe investigația'}
            </button>
          )}
        </footer>
      </main>
    </div>
  )
}
