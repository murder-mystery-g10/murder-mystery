import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AccusationChoices } from '../contracts/game-api'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'

export function AccusationDialog() {
  const isOpen = useGameStore((s) => s.accusationModalOpen)
  const close = useGameStore((s) => s.closeAccusationModal)
  const snapshot = useGameStore((s) => s.snapshot)
  const accusation = useGameStore((s) => s.accusation)
  const isSubmitting = useGameStore((s) => s.isSubmittingAccusation)
  const error = useGameStore((s) => s.accusationError)
  const clearError = useGameStore((s) => s.clearAccusationError)
  const propose = useGameStore((s) => s.proposeAccusation)
  const vote = useGameStore((s) => s.voteAccusation)

  const lobby = useLobbyStore((s) => s.lobby)
  const session = useLobbyStore((s) => s.session)
  const currentUserId = session?.player_id

  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Proposal form state
  const [selectedCulprit, setSelectedCulprit] = useState<string>('')
  const [selectedMotive, setSelectedMotive] = useState<string>('')
  const [selectedMethod, setSelectedMethod] = useState<string>('')

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [isOpen, close])

  if (!isOpen) return null

  const suspects = snapshot?.suspects ?? []
  const motiveOptions = snapshot?.accusation_options?.motive_options ?? []
  const methodOptions = snapshot?.accusation_options?.method_options ?? []

  const handlePropose = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedCulprit || !selectedMotive || !selectedMethod) return
    const choices: AccusationChoices = {
      culprit: selectedCulprit,
      motive: selectedMotive,
      method: selectedMethod,
    }
    await propose(choices)
  }

  // Voting mode view
  if (accusation) {
    const proposer =
      lobby?.players.find((p) => p.id === accusation.proposed_by)?.name ?? 'A detective'
    const accusedSuspect = suspects.find((s) => s.id === accusation.choices.culprit)
    const motiveText =
      motiveOptions.find((m) => m.id === accusation.choices.motive)?.text ??
      accusation.choices.motive
    const methodText =
      methodOptions.find((m) => m.id === accusation.choices.method)?.text ??
      accusation.choices.method

    const userHasVoted =
      currentUserId && accusation.votes && accusation.votes[currentUserId] !== undefined
    const userVote = currentUserId && accusation.votes ? accusation.votes[currentUserId] : undefined

    return (
      <div className="casefile-overlay" onClick={close}>
        <div
          className="casefile-dialog accusation-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="accusation-vote-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="casefile-header">
            <div>
              <span className="casefile-seal">COURT SUMMONS • ARREST WARRANT VOTE</span>
              <h2 id="accusation-vote-title" className="casefile-title">
                Accusation Under Deliberation
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="btn-text-action casefile-close"
              onClick={close}
              aria-label="Close dialog"
            >
              ✕ Close
            </button>
          </header>

          <div className="casefile-body">
            <p className="docket-desc" style={{ marginBottom: '1.25rem' }}>
              <strong>{proposer}</strong> has formulated a final accusation against a suspect. All
              detectives must unanimously approve this warrant to seal the investigation and reveal
              the truth.
            </p>

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

            <div className="accusation-charges-card">
              <div className="accusation-charge-row">
                <span className="accusation-charge-label">Accused Culprit:</span>
                <span className="accusation-charge-val">
                  <strong>{accusedSuspect?.name ?? accusation.choices.culprit}</strong>
                  {accusedSuspect?.role && ` (${accusedSuspect.role})`}
                </span>
              </div>
              <div className="accusation-charge-row">
                <span className="accusation-charge-label">Motive:</span>
                <span className="accusation-charge-val">{motiveText}</span>
              </div>
              <div className="accusation-charge-row">
                <span className="accusation-charge-label">Method:</span>
                <span className="accusation-charge-val">{methodText}</span>
              </div>
            </div>

            <section className="casefile-section" style={{ marginTop: '1.5rem' }}>
              <h3 className="casefile-section-title">Team Deliberation</h3>
              <ul className="accusation-vote-list">
                {lobby?.players.map((player) => {
                  const voteVal = accusation.votes ? accusation.votes[player.id] : undefined
                  const isYou = player.id === currentUserId
                  return (
                    <li key={player.id} className="accusation-vote-item">
                      <span className="vote-player-name">
                        {player.name} {isYou && <strong className="text-brass">(You)</strong>}
                      </span>
                      {voteVal === true && (
                        <span className="vote-badge vote-badge-accepted">✓ Signed Warrant</span>
                      )}
                      {voteVal === false && (
                        <span className="vote-badge vote-badge-rejected">✕ Vetoed</span>
                      )}
                      {voteVal === undefined && (
                        <span className="vote-badge vote-badge-pending">⏳ Deliberating...</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>

            <div className="accusation-actions-bar">
              {userHasVoted ? (
                <p className="order-waiting-status" style={{ margin: 0 }}>
                  Your vote has been registered ({userVote ? 'Signed' : 'Vetoed'}). Waiting for the
                  other detectives...
                </p>
              ) : (
                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                  <button
                    type="button"
                    className="btn-order btn-order-primary"
                    style={{ flex: 1 }}
                    disabled={isSubmitting}
                    onClick={() => vote(true)}
                  >
                    {isSubmitting ? 'Recording...' : '✓ Approve & Sign Warrant'}
                  </button>
                  <button
                    type="button"
                    className="btn-order btn-order-secondary"
                    style={{ flex: 1, borderColor: 'var(--seal-burgundy-border)' }}
                    disabled={isSubmitting}
                    onClick={() => vote(false)}
                  >
                    {isSubmitting ? 'Recording...' : '✕ Reject Accusation'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Proposal formulation mode
  return (
    <div className="casefile-overlay" onClick={close}>
      <div
        className="casefile-dialog accusation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accusation-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="casefile-header">
          <div>
            <span className="casefile-seal">FINAL ACCUSATION • PREFECTURE MANDATE</span>
            <h2 id="accusation-form-title" className="casefile-title">
              Formulate the Accusation
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="btn-text-action casefile-close"
            onClick={close}
            aria-label="Close dialog"
          >
            ✕ Close
          </button>
        </header>

        <form onSubmit={handlePropose} className="casefile-body">
          <p className="docket-desc" style={{ marginBottom: '1.25rem' }}>
            Identify the culprit, establish their motive, and name the method used to commit the
            crime. If approved unanimously by your fellow detectives, the case will be brought to a
            verdict.
          </p>

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

          {/* 1. Culprit Section */}
          <section className="accusation-form-section">
            <h3 className="casefile-section-title">1. The Culprit (Suspect)</h3>
            <div className="accusation-options-grid">
              {suspects.map((suspect) => {
                const isSelected = selectedCulprit === suspect.id
                return (
                  <button
                    type="button"
                    key={suspect.id}
                    className={`accusation-option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedCulprit(suspect.id)}
                  >
                    <span className="accusation-option-header">
                      <strong>{suspect.name}</strong>
                    </span>
                    <span className="accusation-option-sub">{suspect.role}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* 2. Motive Section */}
          <section className="accusation-form-section" style={{ marginTop: '1.5rem' }}>
            <h3 className="casefile-section-title">2. The Motive</h3>
            <div className="accusation-options-stack">
              {motiveOptions.map((motive) => {
                const isSelected = selectedMotive === motive.id
                return (
                  <button
                    type="button"
                    key={motive.id}
                    className={`accusation-option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedMotive(motive.id)}
                  >
                    <span>{motive.text}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* 3. Method Section */}
          <section className="accusation-form-section" style={{ marginTop: '1.5rem' }}>
            <h3 className="casefile-section-title">3. The Method</h3>
            <div className="accusation-options-stack">
              {methodOptions.map((method) => {
                const isSelected = selectedMethod === method.id
                return (
                  <button
                    type="button"
                    key={method.id}
                    className={`accusation-option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedMethod(method.id)}
                  >
                    <span>{method.text}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="accusation-actions-bar" style={{ marginTop: '2rem' }}>
            <button
              type="submit"
              className="btn-order btn-order-primary btn-block"
              disabled={!selectedCulprit || !selectedMotive || !selectedMethod || isSubmitting}
            >
              {isSubmitting ? 'Summoning the team...' : 'Propose Accusation to Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
