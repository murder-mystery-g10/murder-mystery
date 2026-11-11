import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { AccusationDialog } from '../components/AccusationDialog'
import { CasePicker } from '../components/CasePicker'
import { DevBanner } from '../components/DevBanner'
import { EndScreen } from '../components/EndScreen'
import { LobbyCodeBadge } from '../components/LobbyCodeBadge'
import { Navbar } from '../components/Navbar'
import { PlayerList } from '../components/PlayerList'
import { RoomView } from '../components/RoomView'
import { useGameStore } from '../stores/gameStore'
import { useCanStartGame, useIsHost, useLobbyStore } from '../stores/lobbyStore'
import { isMockMode } from '../lib/mock'

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
  const resumeLobby = useLobbyStore((s) => s.resumeLobby)
  const leaveLobby = useLobbyStore((s) => s.leaveLobby)
  const gameResult = useGameStore((s) => s.gameResult)
  const accusation = useGameStore((s) => s.accusation)
  const you = useGameStore((s) => s.snapshot?.you)
  const openAccusationModal = useGameStore((s) => s.openAccusationModal)

  const [directJoinName, setDirectJoinName] = useState('')

  const isHost = useIsHost()
  const { canStart, reason } = useCanStartGame()

  // Load the case library only once the player is in a lobby.
  const inLobby = lobby !== null
  const restoring = !lobby && session?.lobby_code === code?.toUpperCase() && !isMockMode()
  useEffect(() => {
    if (restoring) resumeLobby()
  }, [restoring, resumeLobby])
  useEffect(() => {
    if (inLobby && cases.length === 0) {
      loadCases()
    }
  }, [inLobby, cases.length, loadCases])

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

  if (restoring) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <main className="desk-container">
          <h1 className="desk-title">Reconnecting to the investigation</h1>
          <p role="status">Restoring your saved detective session…</p>
          {error && (
            <p className="dispatch-alert dispatch-alert-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn-order btn-order-primary" onClick={resumeLobby}>
            Retry connection
          </button>
          <button type="button" className="btn-order btn-order-secondary" onClick={leaveLobby}>
            Use a different detective session
          </button>
        </main>
      </div>
    )
  }

  // No matching saved identity: allow quick join directly.
  if (!lobby) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <main className="desk-container" style={{ marginTop: '3.5rem' }}>
          <div className="dossier-entry-card" style={{ maxWidth: '460px', margin: '0 auto' }}>
            <div className="entry-card-header">
              <span className="entry-card-meta">CRIMINAL REGISTRY</span>
              <h1 className="entry-card-title">Join the investigation</h1>
              <p className="entry-card-desc">
                Investigation lobby with code{' '}
                <strong className="text-brass">{code?.toUpperCase()}</strong>.
              </p>
            </div>

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

            <form onSubmit={handleDirectJoin} className="dossier-form">
              <div className="form-field">
                <label htmlFor="direct-join-name">Your detective name</label>
                <input
                  id="direct-join-name"
                  type="text"
                  maxLength={24}
                  required
                  placeholder="e.g. Inspector Georgescu"
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
                {isLoading ? 'Connecting...' : 'Enter lobby'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link to="/" className="text-link-back">
                  ← Back to the station registry
                </Link>
              </div>
            </form>
          </div>
        </main>
      </div>
    )
  }

  // If the game has ended / result is available, show the end screen immediately
  if (gameResult) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <main className="desk-container">
          <EndScreen />
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
          <AccusationDialog />

          {accusation ? (
            <div
              className="dispatch-alert"
              role="alert"
              style={{
                marginBottom: '1.5rem',
                border: '1px solid var(--brass-accent)',
                background: 'rgba(194, 159, 85, 0.12)',
              }}
            >
              <span>
                {you && accusation.votes?.[you] !== undefined
                  ? '⚖️ A final accusation has been proposed. Waiting for the other detectives.'
                  : '⚖️ A final accusation has been proposed and is awaiting your vote!'}
              </span>
              <button
                type="button"
                className="btn-order btn-order-primary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                onClick={openAccusationModal}
              >
                Review & Vote
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn-order btn-order-primary"
                onClick={openAccusationModal}
              >
                ⚖️ Formulate Accusation
              </button>
            </div>
          )}

          <RoomView />
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

        <div className="desk-topbar">
          <div className="desk-case-ident">
            <div className="case-bulletin-tag">CRIMINAL CASE FILE • TASK FORCE SUMMONS</div>
            <h1 className="desk-title">Station Waiting Room</h1>
            <div className="desk-subtitle">
              The assigned officers gather at the station. The lead investigator reviews the case
              file.
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
                  ✓ All conditions are met. The lead investigator can order the team to the manor.
                </span>
              ) : (
                <span className="order-waiting-status">{reason}</span>
              )
            ) : (
              <span className="order-guest-status">
                Waiting for the team leader ({hostPlayer?.name ?? 'the host'}) to finish the case
                file and give the order to set out...
              </span>
            )}
          </div>

          {isHost && (
            <button
              type="button"
              className="btn-order btn-order-primary"
              disabled={!canStart || isLoading}
              onClick={startGame}
              title={reason ?? 'Give the order to begin the investigation'}
            >
              {isLoading ? 'Issuing the order...' : 'Start investigation'}
            </button>
          )}
        </footer>
      </main>
    </div>
  )
}
