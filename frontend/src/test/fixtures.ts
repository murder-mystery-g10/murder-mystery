import type { Briefing, GameSnapshot } from '../contracts/game-api'

export const BRIEFING: Briefing = {
  when: 'The night of November 14, 1926',
  where: 'Vornicu Manor, near Turda',
  victim: { name: 'Matei Vornicu', age: 64, description: 'Owner of the lumber mill.' },
  summary: 'Matei Vornicu died in the manor library on the night of the storm.',
  discovery: 'The housekeeper found him dead in the library armchair at 23:30.',
  coroner_report: [
    'Death occurred between 22:45 and 23:15.',
    'Conclusion: probable poisoning through the tea.',
  ],
  story_hooks: [{ text: 'The greenhouse has a combination lock.', points_to_room: 'greenhouse' }],
}

export function makeSnapshot(briefing: Briefing = BRIEFING): GameSnapshot {
  return {
    lobby: {
      code: 'CASE01',
      status: 'playing',
      solo: false,
      players: [
        { id: 'p1', name: 'Inspector Ion', is_host: true, connected: true, location: null },
      ],
      case: {
        case_id: 'vornicu_1926',
        title: 'Death at Vornicu Manor',
        difficulty: 'normal',
        player_count: 4,
        summary: 'A death on the night of the storm.',
      },
    },
    you: 'p1',
    theme: 'manor_1926',
    started_at: '2026-11-09T10:00:00Z',
    briefing,
    rooms: [],
    notebook: [],
    board: { items: [], links: [] },
    suspects: [],
    interrogations: [],
    accusation_options: { motive_options: [], method_options: [] },
    accusation: null,
  }
}
