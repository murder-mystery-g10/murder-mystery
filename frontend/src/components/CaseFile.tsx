import { useEffect, useRef } from 'react'
import type { Briefing } from '../contracts/game-api'

interface CaseFileProps {
  briefing: Briefing
  /** Case title from the lobby; a generic title is shown without it. */
  caseTitle?: string | null
  onClose: () => void
}

/** The case file: the briefing and the coroner report, shown over the current screen. */
export function CaseFile({ briefing, caseTitle, onClose }: CaseFileProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Focus the dialog when it opens and give focus back to whatever opened it.
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  const { victim } = briefing
  const hooks = briefing.story_hooks ?? []

  return (
    <div className="casefile-overlay" onClick={onClose}>
      <div
        className="casefile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="casefile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="casefile-header">
          <div>
            <span className="casefile-seal">CASE FILE • CONFIDENTIAL</span>
            <h2 id="casefile-title" className="casefile-title">
              {caseTitle ?? 'Case file'}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="btn-text-action casefile-close"
            onClick={onClose}
            aria-label="Close the case file"
          >
            ✕ Close
          </button>
        </header>

        <div className="casefile-body">
          <dl className="casefile-facts">
            <div className="casefile-fact">
              <dt>Victim</dt>
              <dd>
                {victim.name}
                {victim.age != null && `, ${victim.age}`}
              </dd>
            </div>
            <div className="casefile-fact">
              <dt>When</dt>
              <dd>{briefing.when}</dd>
            </div>
            <div className="casefile-fact">
              <dt>Where</dt>
              <dd>{briefing.where}</dd>
            </div>
          </dl>

          <section className="casefile-section" aria-labelledby="casefile-briefing">
            <h3 id="casefile-briefing" className="casefile-section-title">
              Briefing
            </h3>
            <p>{briefing.summary}</p>
          </section>

          <section className="casefile-section" aria-labelledby="casefile-victim">
            <h3 id="casefile-victim" className="casefile-section-title">
              The victim
            </h3>
            <p>{victim.description}</p>
          </section>

          <section className="casefile-section" aria-labelledby="casefile-discovery">
            <h3 id="casefile-discovery" className="casefile-section-title">
              Discovery of the body
            </h3>
            <p>{briefing.discovery}</p>
          </section>

          <section className="casefile-section" aria-labelledby="casefile-coroner">
            <h3 id="casefile-coroner" className="casefile-section-title">
              Coroner&rsquo;s report
            </h3>
            <ol className="casefile-report">
              {briefing.coroner_report.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ol>
          </section>

          {hooks.length > 0 && (
            <section className="casefile-section" aria-labelledby="casefile-leads">
              <h3 id="casefile-leads" className="casefile-section-title">
                Leads
              </h3>
              <ul className="casefile-leads">
                {hooks.map((hook, idx) => (
                  <li key={idx}>{hook.text}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
