import { useRef, useState, type FormEvent } from 'react'
import { roomImage } from '../lib/roomArt'
import { useThemeMap } from '../lib/useThemeMap'
import { useGameStore } from '../stores/gameStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { SuspectPortrait } from './SuspectPortrait'
import interrogationRoomFront from '../../../themes/conac/interrogation_room_front.png'

export function InterrogationScreen({ onReturnToStation }: { onReturnToStation: () => void }) {
  const snapshot = useGameStore((state) => state.snapshot)
  const statuses = useGameStore((state) => state.interrogationStatus)
  const askQuestion = useGameStore((state) => state.askQuestion)
  const socketConnected = useConnectionStore((state) => state.connected)
  const authenticatedLobby = useConnectionStore((state) => state.lobbyCode)
  const session = useLobbyStore((state) => state.session)
  // A successful health ping is not lobby membership. Require the active
  // session to match the personal snapshot received from the game server.
  const connected =
    socketConnected &&
    !!session &&
    authenticatedLobby === session.lobby_code &&
    snapshot?.you === session.player_id &&
    snapshot.lobby.code === session.lobby_code
  const [selected, setSelected] = useState('')
  const { map } = useThemeMap(snapshot?.theme) ?? {}
  const suspect = snapshot?.suspects.find((item) => item.id === selected) ?? snapshot?.suspects[0]
  if (!snapshot) return <p role="status">Loading the interrogation…</p>
  return (
    <section className="interrogation" aria-labelledby="interrogation-title">
      <header className="investigation-board-header">
        <div>
          <span className="investigation-board-kicker">
            POLICE STATION • SHARED INTERVIEW RECORD
          </span>
          <h2 id="interrogation-title" className="investigation-board-title">
            Interrogation room
          </h2>
        </div>
        <button type="button" className="btn-order btn-order-secondary" onClick={onReturnToStation}>
          Return to Police Station
        </button>
      </header>
      <nav className="interrogation-suspects" aria-label="Choose a suspect">
        {snapshot.suspects.map((item) => {
          const interview = snapshot.interrogations.find((record) => record.suspect === item.id)
          const emotion = interview?.entries.at(-1)?.emotion ?? 'calm'
          return (
            <button
              key={item.id}
              type="button"
              className="btn-order btn-order-secondary"
              aria-pressed={suspect?.id === item.id}
              onClick={() => setSelected(item.id)}
            >
              <strong>{item.name}</strong>
              <span>{item.role}</span>
              <span>
                {emotion} ·{' '}
                {interview
                  ? `${interview.questions_left} questions remaining`
                  : 'Loading question limit…'}
              </span>
              {statuses[item.id]?.thinking && <span>Answering…</span>}
            </button>
          )
        })}
      </nav>
      {suspect ? (
        <Interview
          key={`${snapshot.started_at}:${suspect.id}`}
          suspectId={suspect.id}
          connected={connected}
          room={
            snapshot.theme === 'conac'
              ? interrogationRoomFront
              : roomImage(snapshot.theme, 'station', map?.station_image)
          }
          askQuestion={askQuestion}
        />
      ) : (
        <p>No suspects are available in this case.</p>
      )}
    </section>
  )
}

function Interview({
  suspectId,
  connected,
  room,
  askQuestion,
}: {
  suspectId: string
  connected: boolean
  room?: string
  askQuestion: ReturnType<typeof useGameStore.getState>['askQuestion']
}) {
  const snapshot = useGameStore((state) => state.snapshot)!
  const status = useGameStore((state) => state.interrogationStatus[suspectId])
  const suspect = snapshot.suspects.find((item) => item.id === suspectId)!
  const interview = snapshot.interrogations.find((record) => record.suspect === suspectId)
  const [question, setQuestion] = useState('')
  const [evidence, setEvidence] = useState('')
  const submitting = useRef(false)
  const entries = interview?.entries ?? []
  const emotion = entries.at(-1)?.emotion ?? 'calm'
  const clues = snapshot.board.items
    .flatMap((item) => {
      if (item.kind !== 'clue' || !item.ref) return []
      const clue = item.clue ?? snapshot.notebook.find((card) => card.id === item.ref)
      return clue ? [clue] : []
    })
    .filter((clue, index, all) => all.findIndex((item) => item.id === clue.id) === index)
  const chosenClue = clues.find((clue) => clue.id === evidence)
  const atStation =
    snapshot.lobby.players.find((player) => player.id === snapshot.you)?.location === 'station'
  const blocked =
    !connected ||
    !atStation ||
    !interview ||
    interview.questions_left <= 0 ||
    status?.thinking ||
    !!snapshot.result
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blocked || submitting.current || !question.trim()) return
    submitting.current = true
    try {
      const ack = await askQuestion({
        suspect: suspectId,
        question: question.trim(),
        evidence: chosenClue?.id ?? null,
      })
      if (ack.ok) {
        setQuestion('')
        setEvidence('')
      }
    } finally {
      submitting.current = false
    }
  }
  return (
    <div className="interrogation-layout">
      <div>
        <div
          className="interrogation-scene"
          style={room ? { backgroundImage: `url("${room}")` } : undefined}
        >
          <SuspectPortrait
            key={`${suspectId}:${emotion}`}
            theme={snapshot.theme}
            archetype={suspect.archetype}
            emotion={emotion}
            name={suspect.name}
          />
          {room && <div className="interrogation-table-foreground" aria-hidden="true" />}
          {!room && <p>The room image is unavailable.</p>}
        </div>
        <h3>{suspect.name}</h3>
        <p>Current emotion: {emotion}</p>
        <p>
          {interview
            ? `${interview.questions_left} questions remaining`
            : 'Loading question limit…'}
        </p>
        <p>{suspect.initial_statement}</p>
      </div>
      <div className="interrogation-record">
        <h3>Team dialogue history</h3>
        <div
          className="interrogation-history"
          role="log"
          aria-label={`${suspect.name} interview history`}
          aria-live="polite"
        >
          {entries.length === 0 && <p>No questions have been answered yet.</p>}
          {entries.map((entry) => (
            <article key={entry.id}>
              <p>
                <strong>
                  {snapshot.lobby.players.find((player) => player.id === entry.asked_by)?.name ??
                    'Detective'}{' '}
                  — Question
                </strong>
              </p>
              <p>{entry.question}</p>
              {entry.evidence && (
                <p className="interrogation-evidence">
                  Evidence presented:{' '}
                  {clues.find((clue) => clue.id === entry.evidence)?.title ??
                    snapshot.interrogations
                      .flatMap((item) => item.entries)
                      .find((item) => item.id === entry.evidence)?.answer ??
                    entry.evidence}
                </p>
              )}
              <blockquote>
                <strong>{suspect.name} — Answer</strong>
                <p>{entry.answer}</p>
              </blockquote>
            </article>
          ))}
        </div>
        {status?.thinking && <p role="status">The suspect is thinking...</p>}
        {status?.error && (
          <p className="dispatch-alert dispatch-alert-error" role="alert">
            {status.error}
          </p>
        )}
        {!connected && <p role="status">Reconnect to continue the interrogation.</p>}
        {interview?.questions_left === 0 && (
          <p role="status">The team has no questions left for this suspect.</p>
        )}
        <form className="interrogation-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="interrogation-evidence">Present board evidence (optional)</label>
          <select
            id="interrogation-evidence"
            value={chosenClue?.id ?? ''}
            disabled={!!blocked}
            onChange={(event) => setEvidence(event.target.value)}
          >
            <option value="">No evidence</option>
            {clues.map((clue) => (
              <option key={clue.id} value={clue.id}>
                {clue.title}
              </option>
            ))}
          </select>
          {chosenClue && <p>{chosenClue.text}</p>}
          {clues.length === 0 && <p>Pin a clue on the investigation board to present it here.</p>}
          <label htmlFor="interrogation-question">Your question</label>
          <textarea
            id="interrogation-question"
            maxLength={300}
            rows={3}
            value={question}
            disabled={!!blocked}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask the suspect a question…"
          />
          <button
            type="submit"
            className="btn-order btn-order-primary"
            disabled={!!blocked || !question.trim()}
          >
            Ask question
          </button>
        </form>
      </div>
    </div>
  )
}
