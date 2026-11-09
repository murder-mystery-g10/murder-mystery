import type { Player } from '../contracts/game-api'

interface PlayerListProps {
  players: Player[]
  currentUserId?: string
  requiredCount?: number
}

export function PlayerList({ players, currentUserId, requiredCount = 4 }: PlayerListProps) {
  const isFull = players.length >= requiredCount

  return (
    <div className="roster-panel">
      <div className="roster-header">
        <div>
          <h2 className="roster-title">Duty Roster</h2>
          <span className="roster-subtitle">The detective task force</span>
        </div>
        <div className="roster-tally">
          <span className="roster-tally-numbers">
            {players.length}/{requiredCount}
          </span>
          <span className="roster-tally-label">{isFull ? 'Complete' : 'Waiting'}</span>
        </div>
      </div>

      <div className="roster-ledger-rule" />

      <ul className="roster-list" aria-label="Detective list">
        {players.map((player, idx) => {
          const isYou = player.id === currentUserId
          return (
            <li key={player.id} className={`roster-row ${isYou ? 'roster-row-you' : ''}`}>
              <div className="roster-row-left">
                <span className="roster-row-index">0{idx + 1}</span>
                <span
                  className={`presence-pip ${player.connected ? 'presence-pip-on' : 'presence-pip-off'}`}
                  title={player.connected ? 'Present at the station' : 'Disconnected'}
                  aria-label={player.connected ? 'Connected' : 'Disconnected'}
                />
                <div className="roster-names">
                  <span className="roster-name">
                    {player.name}
                    {isYou && <span className="roster-you-mark"> (You)</span>}
                  </span>
                  <span className="roster-assignment">
                    {player.is_host ? 'Lead investigator' : 'Investigating officer'}
                  </span>
                </div>
              </div>

              <div className="roster-row-right">
                {player.is_host && <span className="badge-host-stamp">Host</span>}
              </div>
            </li>
          )
        })}
      </ul>

      {!isFull ? (
        <div className="roster-footer-note">
          The manor is under guard. <strong>{requiredCount} detectives</strong> are needed to search
          the six rooms and question the suspects.
        </div>
      ) : (
        <div className="roster-footer-ready">
          ✓ All {requiredCount} officers are present. You can begin the investigation at the manor.
        </div>
      )}
    </div>
  )
}
