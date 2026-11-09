import type { MapObject } from '../contracts/theme-map'

interface RoomSceneProps {
  image: string
  title: string
  objects?: MapObject[]
  busy: boolean
  onInspect: (object: MapObject) => void
}

export function RoomScene({ image, title, objects = [], busy, onInspect }: RoomSceneProps) {
  return (
    <div className="room-view-scene" aria-busy={busy}>
      <img src={image} alt={title} draggable={false} />
      {objects.length > 0 && (
        <svg
          className="room-object-zones"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="group"
          aria-label="Objects to inspect"
        >
          {objects.map((object) => (
            <polygon
              key={object.id}
              className="room-object-zone"
              points={object.zone.map(({ x, y }) => `${x},${y}`).join(' ')}
              role="button"
              tabIndex={0}
              aria-label={object.name}
              aria-haspopup="dialog"
              aria-disabled={busy}
              onClick={() => {
                if (!busy) onInspect(object)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  if (!busy && !event.repeat) onInspect(object)
                }
              }}
            />
          ))}
        </svg>
      )}
    </div>
  )
}
