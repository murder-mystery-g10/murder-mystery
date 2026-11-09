import type { InspectAck } from '../contracts/game-api'
import { InvestigationDialog } from './InvestigationDialog'

interface InspectionPanelProps {
  objectName: string
  result?: InspectAck
  onClose: () => void
}

export function InspectionPanel({ objectName, result, onClose }: InspectionPanelProps) {
  const clues = result?.clues ?? []

  return (
    <InvestigationDialog title={objectName} onClose={onClose}>
      <div aria-live="polite">
        {!result ? (
          <p className="notebook-empty">Inspecting the object…</p>
        ) : !result.ok ? (
          <p role="alert">{result.error ?? 'Could not inspect the object.'}</p>
        ) : clues.length > 0 ? (
          <ul className="notebook-clues">
            {clues.map((clue) => (
              <li key={clue.id} className="inspection-clue">
                <h3 className="casefile-section-title">{clue.title}</h3>
                <p>{clue.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>{result.text || 'Nothing of interest.'}</p>
        )}
      </div>
    </InvestigationDialog>
  )
}
