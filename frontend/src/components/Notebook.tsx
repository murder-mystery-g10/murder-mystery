import type { ClueCard } from '../contracts/game-api'

interface NotebookProps {
  clues?: ClueCard[]
  onSelectClue: (id: string) => void
}

export function Notebook({ clues = [], onSelectClue }: NotebookProps) {
  return (
    <section className="notebook" aria-labelledby="notebook-title">
      <h2 id="notebook-title" className="notebook-title">
        Investigation notebook
      </h2>
      {clues.length === 0 ? (
        <p className="notebook-empty">No clues found yet.</p>
      ) : (
        <ul className="notebook-clues">
          {clues.map((clue) => (
            <li key={clue.id}>
              <button
                type="button"
                className="notebook-entry"
                aria-haspopup="dialog"
                onClick={() => onSelectClue(clue.id)}
              >
                {clue.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
