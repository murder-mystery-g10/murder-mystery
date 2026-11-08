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
          <h2 className="roster-title">Registrul de Prezență</h2>
          <span className="roster-subtitle">Echipa operativă de detectivi</span>
        </div>
        <div className="roster-tally">
          <span className="roster-tally-numbers">
            {players.length}/{requiredCount}
          </span>
          <span className="roster-tally-label">{isFull ? 'Complet' : 'În așteptare'}</span>
        </div>
      </div>

      <div className="roster-ledger-rule" />

      <ul className="roster-list" aria-label="Lista detectivilor">
        {players.map((player, idx) => {
          const isYou = player.id === currentUserId
          return (
            <li key={player.id} className={`roster-row ${isYou ? 'roster-row-you' : ''}`}>
              <div className="roster-row-left">
                <span className="roster-row-index">0{idx + 1}</span>
                <span
                  className={`presence-pip ${player.connected ? 'presence-pip-on' : 'presence-pip-off'}`}
                  title={player.connected ? 'Prezent la secție' : 'Deconectat'}
                  aria-label={player.connected ? 'Conectat' : 'Deconectat'}
                />
                <div className="roster-names">
                  <span className="roster-name">
                    {player.name}
                    {isYou && <span className="roster-you-mark"> (Tu)</span>}
                  </span>
                  <span className="roster-assignment">
                    {player.is_host ? 'Conducător de anchetă' : 'Ofițer anchetator'}
                  </span>
                </div>
              </div>

              <div className="roster-row-right">
                {player.is_host && <span className="badge-host-stamp">Gazdă</span>}
              </div>
            </li>
          )
        })}
      </ul>

      {!isFull ? (
        <div className="roster-footer-note">
          Conacul se află sub pază. Sunt necesari <strong>{requiredCount} detectivi</strong> pentru
          percheziționarea celor 6 încăperi și interogarea suspecților.
        </div>
      ) : (
        <div className="roster-footer-ready">
          ✓ Toți cei {requiredCount} ofițeri sunt prezenți. Puteți demara ancheta la conac.
        </div>
      )}
    </div>
  )
}
