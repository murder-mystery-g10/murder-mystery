/**
 * Mock mode: the frontend fakes the lobby REST and Socket.IO calls so it can be developed before
 * the backend implements them. It is on only when VITE_USE_MOCK is "true" (see .env.example);
 * otherwise every backend error reaches the player.
 *
 * Read on each call (not cached) so tests can switch it with vi.stubEnv.
 */
export function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true'
}
