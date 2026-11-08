import { useState } from 'react'

interface LobbyCodeBadgeProps {
  code: string
}

export function LobbyCodeBadge({ code }: LobbyCodeBadgeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="dispatch-token">
      <div className="dispatch-token-header">
        <span className="dispatch-label">TELEGRAMĂ CONVOCARE</span>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-copy-token"
          title="Copiază codul camerei"
          aria-label="Copiază codul camerei"
        >
          {copied ? '✓ Copiat' : 'Copiază'}
        </button>
      </div>

      <div className="dispatch-token-body">
        <span className="dispatch-code" data-testid="lobby-code-display">
          {code}
        </span>
      </div>

      <div className="dispatch-token-hint">
        Codul oficial de acces pentru ofițerii mobilizați în caz.
      </div>
    </div>
  )
}
