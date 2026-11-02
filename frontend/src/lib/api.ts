import type { ReadinessResponse } from '../contracts/game-api'

/** Returns the backend's readiness, or null if the backend cannot be reached. */
export async function fetchReadiness(): Promise<ReadinessResponse | null> {
  try {
    const response = await fetch('/api/health/ready')
    // 503 still carries a readiness body: the backend is up, a dependency is not.
    if (response.status !== 200 && response.status !== 503) return null
    return (await response.json()) as ReadinessResponse
  } catch {
    return null
  }
}
