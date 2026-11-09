import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'

export function EndScreen() {
  const result = useGameStore((s) => s.gameResult)
  const snapshot = useGameStore((s) => s.snapshot)
  const leaveLobby = useLobbyStore((s) => s.leaveLobby)

  if (!result) return null

  const { chosen, correct, score, reveal, missed_clues } = result

  // Format elapsed time (seconds -> Mm Ss)
  const minutes = Math.floor(score.elapsed_seconds / 60)
  const seconds = score.elapsed_seconds % 60
  const timeFormatted = `${minutes}m ${seconds.toString().padStart(2, '0')}s`

  // Lookups
  const suspects = snapshot?.suspects ?? []
  const motiveOptions = snapshot?.accusation_options?.motive_options ?? []
  const methodOptions = snapshot?.accusation_options?.method_options ?? []

  const getSuspectName = (id: string) => suspects.find((s) => s.id === id)?.name ?? id
  const getMotiveText = (id: string) => motiveOptions.find((m) => m.id === id)?.text ?? id
  const getMethodText = (id: string) => methodOptions.find((m) => m.id === id)?.text ?? id

  const culpritCorrect = chosen.culprit === correct.culprit
  const motiveCorrect = chosen.motive === correct.motive
  const methodCorrect = chosen.method === correct.method
  const isFlawless = culpritCorrect && motiveCorrect && methodCorrect

  return (
    <div className="endscreen-container">
      <div className="endscreen-card">
        {/* Top Bureau Seal */}
        <header className="endscreen-header">
          <span className="casefile-seal">ROYAL ROMANIAN POLICE • JUDICIAL BUREAU VERDICT</span>
          <h1 className="endscreen-title">
            {isFlawless ? 'Case Solved: Justice Prevails' : 'Case Concluded: The Final Verdict'}
          </h1>
          <p className="endscreen-subtitle">
            The investigation at Vornicu Manor has concluded. The prosecutor has unsealed the truth.
          </p>
        </header>

        {/* Score & Timing Grand Card */}
        <div className="endscreen-score-banner">
          <div className="score-total-box">
            <span className="score-total-label">TOTAL SCORE</span>
            <span className="score-total-number">{score.total}</span>
            <span className="score-total-pts">POINTS</span>
          </div>

          <div className="score-breakdown-grid">
            <div className="score-item">
              <span className="score-item-label">Culprit Identified</span>
              <span className={`score-item-val ${culpritCorrect ? 'positive' : 'zero'}`}>
                {culpritCorrect ? `+${score.culprit} pts` : '0 pts (Incorrect)'}
              </span>
            </div>
            <div className="score-item">
              <span className="score-item-label">Motive Established</span>
              <span className={`score-item-val ${motiveCorrect ? 'positive' : 'zero'}`}>
                {motiveCorrect ? `+${score.motive} pts` : '0 pts (Incorrect)'}
              </span>
            </div>
            <div className="score-item">
              <span className="score-item-label">Method Discovered</span>
              <span className={`score-item-val ${methodCorrect ? 'positive' : 'zero'}`}>
                {methodCorrect ? `+${score.method} pts` : '0 pts (Incorrect)'}
              </span>
            </div>
            <div className="score-item">
              <span className="score-item-label">Time Bonus ({timeFormatted})</span>
              <span className="score-item-val positive">+{score.time_bonus} pts</span>
            </div>
            <div className="score-item">
              <span className="score-item-label">Unused Questions Bonus</span>
              <span className="score-item-val positive">+{score.unused_questions} pts</span>
            </div>
          </div>
        </div>

        {/* Comparison: Accusation vs Truth */}
        <section className="endscreen-section">
          <h2 className="endscreen-section-title">The Verdict vs. The Accusation</h2>
          <div className="verdict-comparison-grid">
            {/* Culprit Card */}
            <div className={`verdict-item-card ${culpritCorrect ? 'correct' : 'incorrect'}`}>
              <div className="verdict-item-header">
                <span className="verdict-item-type">THE CULPRIT</span>
                <span className="verdict-tag">{culpritCorrect ? '✓ CORRECT' : '✕ WRONG'}</span>
              </div>
              <div className="verdict-item-body">
                <div>
                  <span className="verdict-side-label">Team Accused:</span>
                  <p className="verdict-side-val">{getSuspectName(chosen.culprit)}</p>
                </div>
                {!culpritCorrect && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <span className="verdict-side-label">Actual Culprit:</span>
                    <p className="verdict-side-val text-brass">{getSuspectName(correct.culprit)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Motive Card */}
            <div className={`verdict-item-card ${motiveCorrect ? 'correct' : 'incorrect'}`}>
              <div className="verdict-item-header">
                <span className="verdict-item-type">THE MOTIVE</span>
                <span className="verdict-tag">{motiveCorrect ? '✓ CORRECT' : '✕ WRONG'}</span>
              </div>
              <div className="verdict-item-body">
                <div>
                  <span className="verdict-side-label">Team Argued:</span>
                  <p className="verdict-side-val">{getMotiveText(chosen.motive)}</p>
                </div>
                {!motiveCorrect && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <span className="verdict-side-label">Actual Motive:</span>
                    <p className="verdict-side-val text-brass">{getMotiveText(correct.motive)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Method Card */}
            <div className={`verdict-item-card ${methodCorrect ? 'correct' : 'incorrect'}`}>
              <div className="verdict-item-header">
                <span className="verdict-item-type">THE METHOD</span>
                <span className="verdict-tag">{methodCorrect ? '✓ CORRECT' : '✕ WRONG'}</span>
              </div>
              <div className="verdict-item-body">
                <div>
                  <span className="verdict-side-label">Team Argued:</span>
                  <p className="verdict-side-val">{getMethodText(chosen.method)}</p>
                </div>
                {!methodCorrect && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <span className="verdict-side-label">Actual Method:</span>
                    <p className="verdict-side-val text-brass">{getMethodText(correct.method)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Full Reveal Chronicle */}
        <section className="endscreen-section">
          <h2 className="endscreen-section-title">Case Chronicle • The Full Reveal</h2>
          <div className="reveal-chronicle-box">
            {reveal.split('\n\n').map((paragraph, index) => (
              <p key={index} className="reveal-paragraph">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        {/* Missed Clues Section */}
        <section className="endscreen-section">
          <h2 className="endscreen-section-title">
            Evidence Archive •{' '}
            {missed_clues.length === 0
              ? 'No Clues Missed'
              : `${missed_clues.length} Overlooked Clues`}
          </h2>

          {missed_clues.length === 0 ? (
            <div className="empty-clues-banner">
              <span>✦ Exemplary search: Your team uncovered all evidence in the manor!</span>
            </div>
          ) : (
            <div className="missed-clues-grid">
              {missed_clues.map((clue) => (
                <div key={clue.id} className="missed-clue-card">
                  <div className="missed-clue-header">
                    <span className="missed-clue-room">ROOM: {clue.room.toUpperCase()}</span>
                    <span className="missed-clue-id">{clue.id}</span>
                  </div>
                  <h4 className="missed-clue-title">{clue.title}</h4>
                  <p className="missed-clue-desc">{clue.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Action Button */}
        <footer className="endscreen-footer">
          <button type="button" className="btn-order btn-order-primary" onClick={leaveLobby}>
            ← Return to Police Bureau Registry
          </button>
        </footer>
      </div>
    </div>
  )
}
