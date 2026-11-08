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
      return { text: 'Ușor', className: 'dossier-tag-easy' }
    case 'normal':
      return { text: 'Mediu', className: 'dossier-tag-normal' }
    case 'hard':
      return { text: 'Dificil', className: 'dossier-tag-hard' }
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
          <span className="folder-tab-label">DOSAR NR. 1926/V</span>
          <span className="folder-tab-sub">ARHIVA PENALĂ TURDA</span>
        </div>
        <div className="dossier-confidential-stamp">STRICT CONFIDENȚIAL</div>
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
                  <span className="case-file-meta-number">
                    CAUZA PENALĂ • EXONERARE DE LA CLASARE
                  </span>
                  <h3 className="case-file-title">{c.title}</h3>
                  <div className="case-file-place">
                    Conacul Vornicu, Turda • Noaptea de 14–15 Noiembrie 1926
                  </div>
                </div>

                <div className="case-file-tags">
                  <span className={`dossier-tag ${diff.className}`}>{diff.text}</span>
                  <span className="dossier-tag dossier-tag-players">
                    {c.player_count} Detectivi
                  </span>
                </div>
              </div>

              <div className="case-file-divider" />

              <div className="case-file-section">
                <span className="case-file-section-label">RAPORT OPERATIV PRELIMINAR:</span>
                <p className="case-file-summary">{c.summary}</p>
              </div>

              <div className="case-file-briefing-grid">
                <div className="briefing-fact">
                  <span className="fact-label">VICTIMĂ</span>
                  <span className="fact-value">Matei Vornicu, 64 ani (Proprietar cherestea)</span>
                </div>
                <div className="briefing-fact">
                  <span className="fact-label">LOCUL CRIMEI</span>
                  <span className="fact-value">Biblioteca conacului (sub sigiliu judiciar)</span>
                </div>
                <div className="briefing-fact">
                  <span className="fact-label">SUSPECȚI REȚINUȚI</span>
                  <span className="fact-value">4 persoane (medicul, menajera, soția, nepotul)</span>
                </div>
              </div>

              <div className="case-file-footer">
                {isSelected ? (
                  <span className="case-stamp-selected">✓ Dosar Selectat</span>
                ) : isHost ? (
                  <span className="case-pick-prompt">Apasă pentru a alege acest dosar</span>
                ) : null}
              </div>
            </article>
          )
        })}

        {!selectedCaseId && !isHost && (
          <div className="case-empty-notice">
            Gazda analizează dosarele. În curând va fi selectat un caz...
          </div>
        )}
      </div>
    </div>
  )
}
