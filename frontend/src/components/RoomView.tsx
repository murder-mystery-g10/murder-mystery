import { useState } from 'react'
import { roomImage, roomName } from '../lib/roomArt'
import { useGameStore } from '../stores/gameStore'
import { Notebook } from './Notebook'

export function RoomView() {
  const snapshot = useGameStore((state) => state.snapshot)
  const enterRoom = useGameStore((state) => state.enterRoom)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const player = snapshot?.lobby.players.find((player) => player.id === snapshot.you)
  const location = player?.location
  const title = location ? roomName(location) : 'Explorarea conacului'
  const image = snapshot && location ? roomImage(snapshot.theme, location) : undefined

  async function moveTo(room: string) {
    if (moving || room === location) return
    setError(null)
    setMoving(true)
    const ack = await enterRoom(room)
    if (!ack.ok) setError(ack.error ?? 'Nu s-a putut intra în cameră. Încearcă din nou.')
    setMoving(false)
  }

  return (
    <section aria-labelledby="room-view-title">
      <header className="room-view-header">
        <h1 id="room-view-title" className="desk-title">
          {title}
        </h1>
        {snapshot && (
          <nav className="room-view-nav" aria-label="Locațiile tale">
            {snapshot.rooms
              .filter((room) => room.yours)
              .map((room) => (
                <button
                  key={room.room}
                  type="button"
                  className="btn-order btn-order-secondary"
                  aria-current={location === room.room ? 'location' : undefined}
                  disabled={!room.unlocked || moving}
                  onClick={() => void moveTo(room.room)}
                >
                  {roomName(room.room)}
                  {!room.unlocked && ' (încuiată)'}
                </button>
              ))}
            <button
              type="button"
              className="btn-order btn-order-secondary"
              aria-current={location === 'station' ? 'location' : undefined}
              disabled={moving}
              onClick={() => void moveTo('station')}
            >
              {roomName('station')}
            </button>
          </nav>
        )}
        {error && (
          <p className="dispatch-alert dispatch-alert-error" role="alert">
            {error}
          </p>
        )}
      </header>

      <div className="room-view-grid">
        <div className="room-view-scene" aria-busy={moving}>
          {image ? (
            <img src={image} alt={title} />
          ) : (
            <p role="status">
              {snapshot
                ? location
                  ? 'Imaginea acestei camere nu este disponibilă.'
                  : 'Alege o cameră pentru a începe explorarea.'
                : 'Se încarcă datele investigației…'}
            </p>
          )}
        </div>
        <Notebook clues={snapshot?.notebook} />
      </div>
    </section>
  )
}
