import type { ClueCard } from '../contracts/game-api'

interface NotebookProps {
  clues?: ClueCard[]
}

export function Notebook({ clues = [] }: NotebookProps) {
  return (
    <section className="notebook" aria-labelledby="notebook-title">
      <h2 id="notebook-title" className="notebook-title">
        Caiet de investigație
      </h2>
      {clues.length === 0 ? (
        <p className="notebook-empty">Încă nu ai găsit niciun indiciu.</p>
      ) : (
        <ul className="notebook-clues">
          {clues.map((clue) => (
            <li key={clue.id} className="notebook-clue">
              <h3 className="casefile-section-title">{clue.title}</h3>
              <p>{clue.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
