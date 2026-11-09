import type { CaseSummary, Difficulty } from '../contracts/game-api'

interface CasePickerProps {
  cases: CaseSummary[]
  selectedCaseId?: string | null
  isHost: boolean
  isLoading?: boolean
  onSelectCase: (caseId: string) => void
}

function difficultyLabel(diff: Difficulty): { text: string; className: string } {
  switch (diff) {
    case 'easy':
      return { text: 'Easy', className: 'dossier-tag-easy' }
    case 'normal':
      return { text: 'Normal', className: 'dossier-tag-normal' }
    case 'hard':
      return { text: 'Hard', className: 'dossier-tag-hard' }
  }
}

export function CasePicker({
  cases,
  selectedCaseId,
  isHost,
  isLoading = false,
  onSelectCase,
}: CasePickerProps) {
  return (
    <div className="dossier-panel">
      <div className="dossier-panel-header">
        <div className="dossier-folder-tab">
          <span className="folder-tab-label">CASE FILE NO. 1926/V</span>
          <span className="folder-tab-sub">TURDA CRIMINAL ARCHIVE</span>
        </div>
        <div className="dossier-confidential-stamp">STRICTLY CONFIDENTIAL</div>
      </div>

      <div className="dossier-contents">
        {cases.map((c) => {
          const isSelected = selectedCaseId === c.case_id
          const diff = difficultyLabel(c.difficulty)

          return (
            <article
              key={c.case_id}
              className={`case-file ${isSelected ? 'case-file-selected' : ''} ${
                isHost ? 'case-file-interactive' : ''
              }`}
              onClick={() => {
                if (isHost && !isLoading && !isSelected) {
                  onSelectCase(c.case_id)
                }
              }}
              role={isHost ? 'button' : 'region'}
              tabIndex={isHost ? 0 : undefined}
              onKeyDown={(e) => {
                if (isHost && (e.key === 'Enter' || e.key === ' ') && !isLoading) {
                  e.preventDefault()
                  onSelectCase(c.case_id)
                }
              }}
              aria-pressed={isHost ? isSelected : undefined}
            >
              <div className="case-file-topbar">
                <div className="case-file-heading">
                  <span className="case-file-meta-number">CRIMINAL CASE • REOPENED FILE</span>
                  <h3 className="case-file-title">{c.title}</h3>
                  <div className="case-file-place">
                    Vornicu Manor, near Turda • Night of November 14–15, 1926
                  </div>
                </div>

                <div className="case-file-tags">
                  <span className={`dossier-tag ${diff.className}`}>{diff.text}</span>
                  <span className="dossier-tag dossier-tag-players">
                    {c.player_count} Detectives
                  </span>
                </div>
              </div>

              <div className="case-file-divider" />

              <div className="case-file-section">
                <span className="case-file-section-label">PRELIMINARY FIELD REPORT:</span>
                <p className="case-file-summary">{c.summary}</p>
              </div>

              <div className="case-file-briefing-grid">
                <div className="briefing-fact">
                  <span className="fact-label">VICTIM</span>
                  <span className="fact-value">Matei Vornicu, 64 (lumber mill owner)</span>
                </div>
                <div className="briefing-fact">
                  <span className="fact-label">CRIME SCENE</span>
                  <span className="fact-value">The manor library (under judicial seal)</span>
                </div>
                <div className="briefing-fact">
                  <span className="fact-label">SUSPECTS HELD</span>
                  <span className="fact-value">
                    4 people (the doctor, the housekeeper, the wife, the nephew)
                  </span>
                </div>
              </div>

              <div className="case-file-footer">
                {isSelected ? (
                  <span className="case-stamp-selected">✓ Case Selected</span>
                ) : isHost ? (
                  <span className="case-pick-prompt">Click to choose this case</span>
                ) : null}
              </div>
            </article>
          )
        })}

        {!selectedCaseId && !isHost && (
          <div className="case-empty-notice">
            The host is reviewing the case files. A case will be chosen soon...
          </div>
        )}
      </div>
    </div>
  )
}
