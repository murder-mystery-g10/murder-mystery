import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusRow } from './StatusRow'

describe('StatusRow', () => {
  it('shows OK when the service is healthy', () => {
    render(<StatusRow label="Backend" ok />)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('shows unavailable when the service is down', () => {
    render(<StatusRow label="Backend" ok={false} />)
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('shows a pending state while checking', () => {
    render(<StatusRow label="Backend" ok={null} />)
    expect(screen.getByText('Checking…')).toBeInTheDocument()
  })
})
