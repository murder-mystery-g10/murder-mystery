import { useEffect, useState } from 'react'
import { StatusRow } from '../components/StatusRow'
import type { ReadinessResponse } from '../contracts/game-api'
import { fetchReadiness } from '../lib/api'
import { socket } from '../lib/socket'

export function StatusPage() {
  // undefined = still loading, null = backend unreachable
  const [readiness, setReadiness] = useState<ReadinessResponse | null | undefined>(undefined)
  const [pong, setPong] = useState<boolean | null>(null)

  useEffect(() => {
    fetchReadiness().then(setReadiness)
  }, [])

  useEffect(() => {
    const onConnect = async () => {
      try {
        const reply = await socket.timeout(3000).emitWithAck('system:ping', {})
        setPong(reply?.message === 'pong')
      } catch {
        setPong(false)
      }
    }
    const onDisconnect = () => setPong(false)
    const onConnectError = () => setPong(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    if (socket.connected) void onConnect()
    else socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      // This is the application's shared client. Leaving diagnostics must not
      // disconnect an active detective or remove the global lifecycle listeners.
    }
  }, [])

  const loaded = readiness !== undefined
  return (
    <main className="status-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/" style={{ color: '#c29b38', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to the game
        </a>
      </div>
      <h1>System status</h1>
      <ul className="status-list">
        <StatusRow label="Backend" ok={loaded ? readiness !== null : null} />
        <StatusRow label="Database" ok={loaded ? (readiness?.database ?? false) : null} />
        <StatusRow label="AI service" ok={loaded ? (readiness?.ai_service ?? false) : null} />
        <StatusRow label="Socket.IO" ok={pong} />
      </ul>
    </main>
  )
}
