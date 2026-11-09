import { useState } from 'react'
import type { InspectAck, UnlockRoom } from '../contracts/game-api'
import type { MapObject } from '../contracts/theme-map'
import { roomImage, roomName } from '../lib/roomArt'
import { useThemeMap } from '../lib/useThemeMap'
import { useGameStore } from '../stores/gameStore'
import { InspectionPanel } from './InspectionPanel'
import { InvestigationDialog } from './InvestigationDialog'
import { Notebook } from './Notebook'
import { PlayerPresence } from './PlayerPresence'
import { RoomScene } from './RoomScene'
import { RoomUnlockForm } from './RoomUnlockForm'

interface Inspection {
  kind: 'inspection'
  room: string
  name: string
  result?: InspectAck
}

type Detail = Inspection | { kind: 'clue'; id: string }

interface UnlockSelection {
  room: string
  pending?: boolean
  error?: string
}

export function RoomView() {
  const snapshot = useGameStore((state) => state.snapshot)
  const enterRoom = useGameStore((state) => state.enterRoom)
  const inspectObject = useGameStore((state) => state.inspectObject)
  const unlockRoom = useGameStore((state) => state.unlockRoom)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [unlock, setUnlock] = useState<UnlockSelection | null>(null)
  const { map, error: mapError } = useThemeMap(snapshot?.theme) ?? {}

  const player = snapshot?.lobby.players.find((player) => player.id === snapshot.you)
  const location = player?.location
  const room = map?.rooms.find((room) => room.id === location)
  const title = room?.name ?? (location ? roomName(location) : 'Explore the manor')
  const imagePath = location === 'station' ? map?.station_image : room?.image
  const image = snapshot && location ? roomImage(snapshot.theme, location, imagePath) : undefined
  const activeInspection = detail?.kind === 'inspection' && detail.room === location ? detail : null
  const activeClue =
    detail?.kind === 'clue' ? snapshot?.notebook.find((clue) => clue.id === detail.id) : undefined
  const lockedRoom = snapshot?.rooms.find(
    (room) => room.room === unlock?.room && room.yours && !room.unlocked,
  )
  const busy =
    moving || unlock?.pending === true || (activeInspection !== null && !activeInspection.result)
  const roomLabel = (id: string) =>
    map?.rooms.find((entry) => entry.id === id)?.name ?? roomName(id)

  async function moveTo(room: string) {
    if (busy || room === location) return
    setError(null)
    setUnlock(null)
    setMoving(true)
    const ack = await enterRoom(room)
    if (ack.ok) setDetail((current) => (current?.kind === 'inspection' ? null : current))
    else setError(ack.error ?? 'Could not enter the room. Try again.')
    setMoving(false)
  }

  function selectLockedRoom(room: string) {
    setError(null)
    setUnlock((current) => (current?.room === room ? null : { room }))
  }

  async function submitUnlock(request: UnlockRoom) {
    if (busy || request.room !== lockedRoom?.room) return
    const pending = { room: request.room, pending: true }
    setUnlock(pending)
    const ack = await unlockRoom(request)
    setUnlock((current) => {
      if (current !== pending) return current
      if (ack.ok) return null
      return {
        room: request.room,
        error: ack.error ?? 'Could not unlock the room. Try again.',
      }
    })
  }

  async function inspect(object: MapObject) {
    if (!location || busy) return
    const pending: Inspection = { kind: 'inspection', room: location, name: object.name }
    setDetail(pending)
    const result = await inspectObject(object.id)
    setDetail((current) => (current === pending ? { ...pending, result } : current))
  }

  return (
    <section aria-labelledby="room-view-title">
      <header className="room-view-header">
        <h1 id="room-view-title" className="desk-title">
          {title}
        </h1>
        {snapshot && (
          <PlayerPresence
            players={snapshot.lobby.players}
            you={snapshot.you}
            roomLabel={roomLabel}
          />
        )}
        {snapshot && (
          <nav className="room-view-nav" aria-label="Your locations">
            {snapshot.rooms
              .filter((room) => room.yours)
              .map((room) => (
                <button
                  key={room.room}
                  type="button"
                  className="btn-order btn-order-secondary"
                  aria-current={location === room.room ? 'location' : undefined}
                  aria-expanded={room.unlocked ? undefined : lockedRoom?.room === room.room}
                  data-locked={!room.unlocked}
                  disabled={busy || (!room.unlocked && !room.lock)}
                  onClick={() => {
                    if (room.unlocked) void moveTo(room.room)
                    else selectLockedRoom(room.room)
                  }}
                >
                  {roomLabel(room.room)}
                  {!room.unlocked && ' (locked)'}
                </button>
              ))}
            <button
              type="button"
              className="btn-order btn-order-secondary"
              aria-current={location === 'station' ? 'location' : undefined}
              disabled={busy}
              onClick={() => void moveTo('station')}
            >
              {roomName('station')}
            </button>
          </nav>
        )}
        {snapshot && lockedRoom?.lock && (
          <RoomUnlockForm
            key={lockedRoom.room}
            room={lockedRoom.room}
            name={roomLabel(lockedRoom.room)}
            lock={lockedRoom.lock}
            notebook={snapshot.notebook}
            pending={unlock?.pending === true}
            error={unlock?.error}
            onUnlock={(request) => void submitUnlock(request)}
            onCancel={() => setUnlock(null)}
          />
        )}
        {mapError && (
          <p className="dispatch-alert dispatch-alert-error" role="alert">
            {mapError}
          </p>
        )}
        {error && (
          <p className="dispatch-alert dispatch-alert-error" role="alert">
            {error}
          </p>
        )}
      </header>

      <div className="room-view-grid">
        {image ? (
          <RoomScene
            image={image}
            title={title}
            objects={location === 'station' ? undefined : room?.objects}
            busy={busy}
            onInspect={(object) => void inspect(object)}
          />
        ) : (
          <div className="room-view-scene">
            <p role="status">
              {snapshot
                ? location
                  ? 'The room image is unavailable.'
                  : 'Choose a room to start exploring.'
                : 'Loading the investigation…'}
            </p>
          </div>
        )}
        <Notebook
          clues={snapshot?.notebook}
          onSelectClue={(id) => setDetail({ kind: 'clue', id })}
        />
      </div>
      {activeInspection && (
        <InspectionPanel
          objectName={activeInspection.name}
          result={activeInspection.result}
          onClose={() => setDetail(null)}
        />
      )}
      {activeClue && (
        <InvestigationDialog title={activeClue.title} onClose={() => setDetail(null)}>
          <p>{activeClue.text}</p>
        </InvestigationDialog>
      )}
    </section>
  )
}
