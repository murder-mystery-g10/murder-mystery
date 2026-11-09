import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { CaseFile } from './CaseFile'

/**
 * The "Case file" button and the case file itself. It lives in the navbar, so the case file can
 * be opened from every screen once the game has started; other screens can also call
 * useGameStore's openCaseFile.
 */
export function CaseFileLauncher() {
  const briefing = useGameStore((s) => s.briefing)
  const isOpen = useGameStore((s) => s.caseFileOpen)
  const openCaseFile = useGameStore((s) => s.openCaseFile)
  const closeCaseFile = useGameStore((s) => s.closeCaseFile)
  const caseTitle = useLobbyStore((s) => s.lobby?.case?.title)

  if (!briefing) return null

  return (
    <>
      <button
        type="button"
        className="btn-text-action casefile-launch"
        onClick={openCaseFile}
        aria-haspopup="dialog"
        title="Read the briefing and the coroner report"
      >
        Case file
      </button>
      {isOpen && <CaseFile briefing={briefing} caseTitle={caseTitle} onClose={closeCaseFile} />}
    </>
  )
}
