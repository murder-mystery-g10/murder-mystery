import { useEffect, useState } from 'react'
import { StatusRow } from '../components/StatusRow'
import { fetchReadiness, type Readiness } from '../lib/api'
import { socket } from '../lib/socket'
import { useConnectionStore } from '../stores/connectionStore'

export function StatusPage() {
  // undefined = still loading, null = backend unreachable
  const [readiness, setReadiness] = useState<Readiness | null | undefined>(undefined)
  const [pong, setPong] = useState<boolean | null>(null)
  const setConnected = useConnectionStore((state) => state.setConnected)

  useEffect(() => {
    fetchReadiness().then(setReadiness)
  }, [])

  useEffect(() => {
    const onConnect = async () => {
      setConnected(true)
      try {
        const reply = await socket.timeout(3000).emitWithAck('system:ping', {})
        setPong(reply?.message === 'pong')
      } catch {
        setPong(false)
      }
    }
    const onDisconnect = () => setConnected(false)
    const onConnectError = () => setPong(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.disconnect()
    }
  }, [setConnected])

  const loaded = readiness !== undefined
  return (
    <main>
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
