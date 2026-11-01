// Temporary hand-written type; generated from the contracts in setup step 9b.
export interface Readiness {
  database: boolean
  ai_service: boolean
}

/** Returns the backend's readiness, or null if the backend cannot be reached. */
export async function fetchReadiness(): Promise<Readiness | null> {
  try {
    const response = await fetch('/api/health/ready')
    // 503 still carries a readiness body: the backend is up, a dependency is not.
    if (response.status !== 200 && response.status !== 503) return null
    return (await response.json()) as Readiness
  } catch {
    return null
  }
}
