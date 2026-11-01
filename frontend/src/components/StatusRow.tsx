interface StatusRowProps {
  label: string
  /** null while the check is still running */
  ok: boolean | null
}

export function StatusRow({ label, ok }: StatusRowProps) {
  const state = ok === null ? 'pending' : ok ? 'ok' : 'down'
  const text = ok === null ? 'Se verifică…' : ok ? 'OK' : 'Indisponibil'
  return (
    <li className="status-row">
      <span>{label}</span>
      <span data-state={state}>{text}</span>
    </li>
  )
}
