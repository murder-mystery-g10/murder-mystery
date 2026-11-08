import type {
  CaseSummary,
  CreateLobbyRequest,
  JoinLobbyRequest,
  LobbySession,
  ReadinessResponse,
} from '../contracts/game-api'

/**
 * Case library. Currently includes only the initial validated reference case
 * (cases/vornicu_1926.json).
 */
export const MOCK_CASES: CaseSummary[] = [
  {
    case_id: 'vornicu_1926',
    title: 'Moarte la Conacul Vornicu',
    difficulty: 'normal',
    player_count: 4,
    summary:
      'Matei Vornicu a fost găsit mort în biblioteca conacului în noaptea furtunii. Medicul de familie susține că a fost un atac de cord, însă menajera a insistat să fie chemată poliția. Toți cei patru suspecți au dormit la conac și așteaptă acum la secție.',
  },
]

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

/**
 * Creates a new lobby on the backend.
 * Falls back to mock session if backend returns 501 or is unreachable.
 */
export async function createLobby(
  data: CreateLobbyRequest,
): Promise<{ session: LobbySession; isMock: boolean }> {
  try {
    const response = await fetch('/api/lobbies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (response.status === 201) {
      const session = (await response.json()) as LobbySession
      return { session, isMock: false }
    }
  } catch {
    // Backend offline, 501, or running in test/jsdom environment without base URL
  }

  // Mock fallback for development before backend is ready
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString()
  const mockCode = `CRIME${randomSuffix.slice(0, 2)}`
  const mockSession: LobbySession = {
    lobby_code: mockCode,
    player_id: `player_${Date.now()}`,
    player_token: `token_${Math.random().toString(36).substring(2)}`,
  }
  return { session: mockSession, isMock: true }
}

/**
 * Joins an existing lobby by code.
 * Falls back to mock session if backend returns 501 or is unreachable.
 */
export async function joinLobby(
  code: string,
  data: JoinLobbyRequest,
): Promise<{ session: LobbySession; isMock: boolean }> {
  const normalizedCode = code.trim().toUpperCase()

  try {
    const response = await fetch(`/api/lobbies/${encodeURIComponent(normalizedCode)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (response.status === 200) {
      const session = (await response.json()) as LobbySession
      return { session, isMock: false }
    }
  } catch {
    // Backend offline, 501, or running in test/jsdom environment without base URL
  }

  // Mock fallback for development before backend is ready
  const mockSession: LobbySession = {
    lobby_code: normalizedCode,
    player_id: `player_${Date.now()}`,
    player_token: `token_${Math.random().toString(36).substring(2)}`,
  }
  return { session: mockSession, isMock: true }
}

/**
 * Fetches the library of available cases.
 * Falls back to mock cases if backend returns 501 or is unreachable.
 */
export async function fetchCases(): Promise<CaseSummary[]> {
  try {
    const response = await fetch('/api/cases')
    if (response.ok) {
      return (await response.json()) as CaseSummary[]
    }
  } catch {
    // Backend offline or unreachable
  }
  return MOCK_CASES
}
