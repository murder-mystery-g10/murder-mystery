import type { FormEvent } from 'react'
import type { ClueCard, RoomAccess, UnlockRoom } from '../contracts/game-api'

interface RoomUnlockFormProps {
  room: string
  name: string
  lock: NonNullable<RoomAccess['lock']>
  notebook: ClueCard[]
  pending: boolean
  error?: string
  onUnlock: (request: UnlockRoom) => void
  onCancel: () => void
}

export function RoomUnlockForm({
  room,
  name,
  lock,
  notebook,
  pending,
  error,
  onUnlock,
  onCancel,
}: RoomUnlockFormProps) {
  const usesKey = lock === 'key'
  const keys = notebook.filter((clue) => clue.icon === 'key')
  const hasNoKey = usesKey && keys.length === 0

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const credential = new FormData(event.currentTarget).get('credential')
    if (pending || typeof credential !== 'string' || !credential.trim()) return

    onUnlock(usesKey ? { room, key_clue: credential } : { room, code: credential.trim() })
  }

  return (
    <form
      id="room-unlock-form"
      className="room-unlock-form"
      aria-labelledby="room-unlock-title"
      onSubmit={submit}
    >
      <h2 id="room-unlock-title" className="casefile-section-title">
        Unlock {name}
      </h2>
      {usesKey ? (
        <div className="form-field">
          <label htmlFor="room-unlock-key">Key from your notebook</label>
          <select
            id="room-unlock-key"
            className="dossier-input"
            name="credential"
            defaultValue=""
            disabled={pending || hasNoKey}
            required
          >
            <option value="" disabled>
              Choose a key
            </option>
            {keys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.title}
              </option>
            ))}
          </select>
          {hasNoKey && <p className="notebook-empty">You have not found a key yet.</p>}
        </div>
      ) : (
        <div className="form-field">
          <label htmlFor="room-unlock-code">Code</label>
          <input
            id="room-unlock-code"
            className="dossier-input"
            name="credential"
            type="text"
            autoComplete="off"
            disabled={pending}
            required
          />
        </div>
      )}
      {error && (
        <p className="dispatch-alert dispatch-alert-error" role="alert">
          {error}
        </p>
      )}
      <div className="room-view-nav">
        <button
          type="submit"
          className="btn-order btn-order-primary"
          disabled={pending || hasNoKey}
        >
          {pending ? 'Checking…' : 'Unlock'}
        </button>
        <button
          type="button"
          className="btn-order btn-order-secondary"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
