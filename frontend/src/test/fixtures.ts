import type { Briefing, GameResult, GameSnapshot, SuspectCard } from '../contracts/game-api'

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

export const SUSPECTS: SuspectCard[] = [
  {
    id: 'strat',
    name: 'Dr. Ilie Strat',
    role: 'Family Doctor',
    archetype: 'doctor',
    initial_statement: 'Matei was a good friend. I tried to save him.',
  },
  {
    id: 'ana',
    name: 'Ana Mureșan',
    role: 'Housekeeper',
    archetype: 'housekeeper',
    initial_statement: 'I brought the master his evening tea as usual.',
  },
]

export const MOTIVE_OPTIONS = [
  {
    id: 'motive_hospital',
    text: 'He was taking money from the charity hospital to save his sanatorium.',
  },
  {
    id: 'motive_inheritance',
    text: 'He wanted to inherit the mill and pay his gambling debts.',
  },
]

export const METHOD_OPTIONS = [
  {
    id: 'method_bottle_swap',
    text: 'Pure digitoxin in a bottle identical to the heart drops.',
  },
  {
    id: 'method_tea_kitchen',
    text: 'Poison placed directly in the tea in the kitchen.',
  },
]

export const GAME_RESULT: GameResult = {
  chosen: {
    culprit: 'strat',
    motive: 'motive_hospital',
    method: 'method_bottle_swap',
  },
  correct: {
    culprit: 'strat',
    motive: 'motive_hospital',
    method: 'method_bottle_swap',
  },
  score: {
    culprit: 500,
    motive: 250,
    method: 250,
    time_bonus: 100,
    unused_questions: 60,
    total: 1160,
    elapsed_seconds: 1120,
  },
  reveal: 'Matei Vornicu was murdered by the doctor he had trusted for years.',
  missed_clues: [
    {
      id: 'B5',
      title: 'Keys below the armchair',
      icon: 'key',
      text: 'A set of brass keys hidden under the cushion.',
      room: 'library',
    },
  ],
}

export function makeSnapshot(briefing: Briefing = BRIEFING): GameSnapshot {
  return {
    lobby: {
      code: 'CASE01',
      status: 'playing',
      solo: false,
      players: [
        { id: 'p1', name: 'Inspector Ion', is_host: true, connected: true, location: null },
        { id: 'p2', name: 'Detective Maria', is_host: false, connected: true, location: null },
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
    theme: 'conac',
    started_at: '2026-11-09T10:00:00Z',
    briefing,
    rooms: [],
    notebook: [],
    board: { items: [], links: [] },
    suspects: SUSPECTS,
    interrogations: [],
    accusation_options: {
      motive_options: MOTIVE_OPTIONS,
      method_options: METHOD_OPTIONS,
    },
    accusation: null,
  }
}
