import type { Player } from '../contracts/game-api'

interface PlayerPresenceProps {
  players: Player[]
  you: string
  roomLabel: (id: string) => string
}

export function PlayerPresence({ players, you, roomLabel }: PlayerPresenceProps) {
  return (
    <section aria-labelledby="room-presence-title">
      <h2 id="room-presence-title" className="casefile-section-title">
        Detectives
      </h2>
      <ul className="room-presence-list">
        {players.map((player) => (
          <li key={player.id} className="room-presence-player">
            <span
              className={`presence-pip ${player.connected ? 'presence-pip-on' : 'presence-pip-off'}`}
              aria-hidden="true"
            />
            <div>
              <strong>{player.name}</strong>
              {player.id === you && <span className="roster-you-mark"> (You)</span>}
              <span className="room-presence-location">
                {!player.connected && 'Offline · '}
                {player.location ? roomLabel(player.location) : 'No room yet'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
