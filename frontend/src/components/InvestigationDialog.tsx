import { useEffect, useId, useRef, type ReactNode } from 'react'

interface InvestigationDialogProps {
  title: string
  children: ReactNode
  onClose: () => void
}

export function InvestigationDialog({ title, children, onClose }: InvestigationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const trigger = document.activeElement
    dialog.showModal()
    closeRef.current?.focus()

    return () => {
      dialog.close()
      if (
        (trigger instanceof HTMLElement || trigger instanceof SVGElement) &&
        trigger.isConnected
      ) {
        trigger.focus()
      }
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="casefile-dialog investigation-detail"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className="casefile-header">
        <h2 id={titleId} className="casefile-title">
          {title}
        </h2>
        <button
          ref={closeRef}
          type="button"
          className="btn-text-action casefile-close investigation-detail-close"
          onClick={onClose}
          aria-label="Close details"
          title="Close"
        >
          ×
        </button>
      </header>
      <div className="casefile-body investigation-detail-body">{children}</div>
    </dialog>
  )
}
