import type {
  CaseSummary,
  CreateLobbyRequest,
  JoinLobbyRequest,
  LobbySession,
  ReadinessResponse,
} from '../contracts/game-api'
import type { ThemeMap } from '../contracts/theme-map'
import { isMockMode } from './mock'

/**
 * Case library used in mock mode. Currently includes only the initial validated reference case
 * (cases/vornicu_1926.json).
 */
export const MOCK_CASES: CaseSummary[] = [
  {
    case_id: 'vornicu_1926',
    title: 'Death at Vornicu Manor',
    difficulty: 'normal',
    player_count: 4,
    summary:
      'Matei Vornicu died in the manor library on the night of the storm. The family doctor said “heart attack,” but the housekeeper insisted that the police be called. The storm cut the telephone line, so the police only arrived at dawn. You are Turda Police detectives and take over the case this morning. All four suspects spent the night at the manor and are now waiting at the station. The house is searched by sectors: every room is searched by two detectives, so there is always a witness to the search, and each of you has three rooms. The prosecutor does not allow doors to be forced in the house of a family like the Vornicus: find the keys. The rest of the house was searched at dawn and nothing was found; you are responsible for the six key rooms.',
  },
]

/** A failed backend call. `message` is ready to show to the player. */
export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const UNREACHABLE = 'Cannot reach the game server. Check your connection and try again.'

/** Status-specific messages for one endpoint; anything else falls back to a generic message. */
type StatusMessages = Partial<Record<number, string>>

async function readDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
      return body.detail
    }
  } catch {
    // No JSON body
  }
  return null
}

async function toApiError(response: Response, messages: StatusMessages): Promise<ApiError> {
  const detail = await readDetail(response)
  const status = response.status
  let message = messages[status]
  if (!message) {
    if (status === 501) {
      message = 'The server does not support this yet.'
    } else if (status >= 500) {
      message = `The game server ran into a problem (error ${status}). Try again in a moment.`
    } else {
      message = detail ?? `The server rejected the request (error ${status}).`
    }
  }
  return new ApiError(message, status)
}

/** fetch() that turns a network failure into an ApiError. */
async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new ApiError(UNREACHABLE, null)
  }
}

function postJson(url: string, data: unknown): Promise<Response> {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

function mockSession(lobbyCode: string): LobbySession {
  return {
    lobby_code: lobbyCode,
    player_id: `player_${Date.now()}`,
    player_token: `token_${Math.random().toString(36).substring(2)}`,
  }
}

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

/** Creates a new lobby; the creator is the host. Throws ApiError on failure. */
export async function createLobby(data: CreateLobbyRequest): Promise<LobbySession> {
  if (isMockMode()) {
    const randomSuffix = Math.floor(10 + Math.random() * 90).toString()
    return mockSession(`CRIME${randomSuffix}`)
  }

  const response = await postJson('/api/lobbies', data)
  if (!response.ok) throw await toApiError(response, {})
  return (await response.json()) as LobbySession
}

/** Joins an existing lobby by code. Throws ApiError on failure. */
export async function joinLobby(code: string, data: JoinLobbyRequest): Promise<LobbySession> {
  const normalizedCode = code.trim().toUpperCase()
  if (isMockMode()) return mockSession(normalizedCode)

  const response = await postJson(`/api/lobbies/${encodeURIComponent(normalizedCode)}/join`, data)
  if (!response.ok) {
    const detail409 = response.status === 409 ? await readDetail(response.clone()) : null
    throw await toApiError(response, {
      404: `No lobby with code ${normalizedCode} exists. Check the code and try again.`,
      409: detail409 ?? 'That name is already taken in this lobby. Choose another name.',
    })
  }
  return (await response.json()) as LobbySession
}

/** Fetches the library of available cases. Throws ApiError on failure. */
export async function fetchCases(): Promise<CaseSummary[]> {
  if (isMockMode()) return MOCK_CASES

  const response = await request('/api/cases')
  if (!response.ok) {
    const error = await toApiError(response, {})
    throw new ApiError(`Could not load the case library. ${error.message}`, error.status)
  }
  return (await response.json()) as CaseSummary[]
}

const bundledThemeMaps = import.meta.glob<ThemeMap>('../../../themes/*/map.json', {
  import: 'default',
})

export async function fetchThemeMap(theme: string, signal: AbortSignal): Promise<ThemeMap> {
  if (isMockMode()) {
    // The offline lobby uses the same authored map as the backend.
    const loadMap = bundledThemeMaps[`../../../themes/${theme}/map.json`]
    if (!loadMap) throw new ApiError('No map for this theme.', 404)
    return loadMap()
  }

  const response = await request(`/api/themes/${encodeURIComponent(theme)}/map`, { signal })
  if (!response.ok) throw await toApiError(response, {})
  return (await response.json()) as ThemeMap
}
