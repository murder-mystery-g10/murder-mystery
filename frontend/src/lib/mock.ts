import type {
  Ack,
  Briefing,
  ClueCard,
  GameSnapshot,
  InspectAck,
  LobbyState,
  UnlockRoom,
} from '../contracts/game-api'

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

/**
 * Briefing copied from cases/vornicu_1926.json for local mock games.
 */
export const MOCK_BRIEFING: Briefing = {
  when: 'The night of Sunday, November 14, to Monday, November 15, 1926, during a storm',
  where: 'Vornicu Manor, near Turda',
  victim: {
    name: 'Matei Vornicu',
    age: 64,
    description:
      'Owner of the Vornicu lumber mill and patron of the Turda Charity Hospital. He had a heart condition and took digitalis drops in his tea every evening at ten.',
  },
  summary:
    'Matei Vornicu died in the manor library on the night of the storm. The family doctor said “heart attack,” but the housekeeper insisted that the police be called. The storm cut the telephone line, so the police only arrived at dawn. You are Turda Police detectives and take over the case this morning. All four suspects spent the night at the manor and are now waiting at the station. The house is searched by sectors: every room is searched by two detectives, so there is always a witness to the search, and each of you has three rooms. The prosecutor does not allow doors to be forced in the house of a family like the Vornicus: find the keys. The rest of the house was searched at dawn and nothing was found; you are responsible for the six key rooms.',
  discovery:
    'The housekeeper, Ana Mureșan, found him dead in the library armchair at 23:30, when she came to collect the tea tray. Dr. Ilie Strat, who had stayed the night because of the storm, pronounced him dead at 23:35 and said it was a heart attack. Ana asked for the police to be called and preserved the teacup.',
  coroner_report: [
    'Death occurred between 22:45 and 23:15 due to sudden cardiac arrest.',
    'No signs of violence. No vomiting and no stomach lesions.',
    'Teacup: a bitter residue, an unknown substance in a very high concentration. Exact identification will take three days at the Cluj laboratory.',
    'Heart-drop bottle on the desk: a sample was taken; normal contents and concentration. The bottle was left in place.',
    'Conclusion: probable poisoning through the tea.',
  ],
  story_hooks: [
    {
      text: 'Ana: “The master wrote in his journal at the desk every evening.”',
      points_to_room: 'library',
    },
    {
      text: 'Ana: “I set the cup aside in the kitchen. Nobody washed it.”',
      points_to_room: 'kitchen',
    },
    { text: 'Ana: “I keep the spare room keys in the kitchen.”', points_to_room: 'kitchen' },
    {
      text: 'The doctor locked the guest room before coming to the station.',
      points_to_room: 'guest_room',
    },
    {
      text: 'The greenhouse belongs to Mrs. Elena and has a combination lock.',
      points_to_room: 'greenhouse',
    },
  ],
}

/** Starts a local preview with an example of each lock type. */
export function makeMockSnapshot(lobby: LobbyState, playerId: string): GameSnapshot {
  return {
    lobby: {
      ...lobby,
      players: lobby.players.map((player) =>
        player.id === playerId ? { ...player, location: 'library' } : player,
      ),
    },
    you: playerId,
    theme: 'conac',
    started_at: new Date().toISOString(),
    briefing: MOCK_BRIEFING,
    rooms: [
      { room: 'hall', yours: true, unlocked: true },
      { room: 'library', yours: true, unlocked: true },
      { room: 'master_bedroom', yours: true, unlocked: false, lock: 'key' },
      { room: 'greenhouse', yours: true, unlocked: false, lock: 'code' },
    ],
    notebook: [],
    board: { items: [], links: [] },
    suspects: [],
    interrogations: [],
    accusation_options: { motive_options: [], method_options: [] },
  }
}

/** Small local fixture for testing a zone exported by the editor. */
export function mockInspection(object: string, playerId: string): InspectAck {
  if (object === 'library.medicine_bottle') {
    return {
      ok: true,
      clues: [
        {
          id: 'B3',
          title: 'Heart-drop bottle',
          text: 'The bottle has a white stopper and a police tag.',
          icon: 'bottle',
          room: 'library',
          found_by: playerId,
        },
      ],
    }
  }
  if (object === 'library.clock') {
    return { ok: true, text: 'The tall clock by the armchair has stopped.' }
  }
  if (object === 'library.armchair') {
    return {
      ok: true,
      clues: [
        {
          id: 'B5',
          title: 'Master bedroom key',
          text: 'You found a key under the library armchair.',
          icon: 'key',
          room: 'library',
          found_by: playerId,
        },
      ],
    }
  }
  return { ok: true }
}

export function mockUnlockRoom(request: UnlockRoom, notebook: ClueCard[]): Ack {
  if (request.room === 'master_bedroom') {
    const hasKey = notebook.some((clue) => clue.id === request.key_clue && clue.icon === 'key')
    if (!hasKey) return { ok: false, error: 'Choose a key from your notebook.' }
    if (request.key_clue === 'B5') return { ok: true }
    return { ok: false, error: 'That key does not fit.' }
  }
  // The local preview has its own test code.
  if (request.room === 'greenhouse') {
    return request.code === '0427' ? { ok: true } : { ok: false, error: 'Incorrect code.' }
  }
  return { ok: false, error: 'This room cannot be unlocked.' }
}
