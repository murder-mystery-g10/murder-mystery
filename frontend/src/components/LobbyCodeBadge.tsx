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
        <span className="dispatch-label">SUMMONS TELEGRAM</span>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-copy-token"
          title="Copy the lobby code"
          aria-label="Copy the lobby code"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="dispatch-token-body">
        <span className="dispatch-code" data-testid="lobby-code-display">
          {code}
        </span>
      </div>

      <div className="dispatch-token-hint">
        The official access code for the officers assigned to the case.
      </div>
    </div>
  )
}
