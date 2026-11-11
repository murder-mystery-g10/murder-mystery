import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Emotion, InterrogationAnswer } from '../contracts/game-api'
import { socket } from '../lib/socket'
import { useGameStore } from '../stores/gameStore'
import { makeSnapshot } from '../test/fixtures'
import { InterrogationScreen } from './InterrogationScreen'
import { SuspectPortrait } from './SuspectPortrait'

vi.mock('../lib/useThemeMap', () => ({ useThemeMap: () => undefined }))
const emotions = [
  'calm',
  'nervous',
  'angry',
  'sad',
  'arrogant',
  'broken',
] as const satisfies readonly Emotion[]
const suspects = [
  { id: 'strat', name: 'Dr. Ilie Strat', archetype: 'doctor', path: 'dr_ilie_strat/dr_strat' },
  { id: 'ana', name: 'Ana Mureșan', archetype: 'housekeeper', path: 'ana_muresan/ana_muresan' },
  {
    id: 'victor',
    name: 'Victor Vornicu',
    archetype: 'heir',
    path: 'victor_vornicu/victor_vornicu',
  },
  { id: 'elena', name: 'Elena Vornicu', archetype: 'lady', path: 'elena_vornicu/elena_vornicu' },
]
// Keep real asset imports and components. Simulate only image decoding and canvas,
// which jsdom cannot render. No socket connects or outbound requests are made.
class TestImage {
  src = ''
  naturalWidth = 2
  naturalHeight = 1
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    images.push(this)
  }
}
let images: TestImage[]
let drawImage: ReturnType<typeof vi.fn>
let putImageData: ReturnType<typeof vi.fn>
beforeEach(() => {
  images = []
  drawImage = vi.fn()
  putImageData = vi.fn()
  vi.stubGlobal('Image', TestImage)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
    getImageData: () => ({ data: new Uint8ClampedArray([0, 255, 0, 255, 120, 80, 60, 255]) }),
    putImageData,
  } as never)
  useGameStore.getState().reset()
})
afterEach(() => {
  useGameStore.getState().reset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function expectPortrait(suspect: (typeof suspects)[number], emotion: Emotion) {
  const image = images.at(-1)!
  expect(image.src).toContain(`/themes/conac/portraits/${suspect.path}_${emotion}.webp`)
  act(() => image.onload?.())
  expect(drawImage).toHaveBeenLastCalledWith(image, 0, 0)
  expect(screen.getByRole('img', { name: `${suspect.name}, ${emotion}` })).toBeVisible()
  expect(putImageData.mock.calls.at(-1)?.[0].data).toEqual(
    new Uint8ClampedArray([0, 255, 0, 0, 120, 80, 60, 255]),
  )
}
function seedScreen() {
  const snapshot = makeSnapshot()
  snapshot.suspects = suspects.map(({ id, name, archetype }) => ({
    id,
    name,
    archetype,
    role: archetype,
    initial_statement: 'Test initial statement.',
  }))
  snapshot.interrogations = suspects.map(({ id }) => ({
    suspect: id,
    questions_left: 8,
    entries: [],
  }))
  useGameStore.getState().applySnapshot(snapshot)
  return snapshot
}
function answerFor(suspect: string, emotion: Emotion, index: number): InterrogationAnswer {
  return {
    entry: {
      id: `${suspect}-${index}`,
      suspect,
      emotion,
      asked_by: 'p2',
      question: `Test question ${index}`,
      answer: `Test answer ${index}`,
      evidence: null,
      intensity: 0.5,
    },
    questions_left: 7 - index,
  }
}
function deliverAnswer(answer: InterrogationAnswer) {
  act(() => {
    for (const listener of socket.listeners('interrogation:answer')) listener(answer)
  })
}
describe('portrait asset mapping', () => {
  it.each(suspects.flatMap((suspect) => emotions.map((emotion) => ({ ...suspect, emotion }))))(
    'selects and draws $archetype / $emotion from the existing asset set',
    (suspect) => {
      render(
        <SuspectPortrait
          theme="conac"
          archetype={suspect.archetype}
          emotion={suspect.emotion}
          name={suspect.name}
        />,
      )
      expectPortrait(suspect, suspect.emotion)
    },
  )
  it('falls back safely when a case has no matching portrait assets', () => {
    render(
      <SuspectPortrait theme="unknown" archetype="unknown" emotion="calm" name="New suspect" />,
    )
    expect(screen.getByText('Portrait unavailable for New suspect.')).toBeInTheDocument()
  })
  it('shows a fallback if the browser fails to load an existing asset', () => {
    render(<SuspectPortrait theme="conac" archetype="doctor" emotion="angry" name="Doctor" />)
    act(() => images.at(-1)!.onerror?.())
    expect(screen.getByText('Portrait unavailable for Doctor.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
  it('ignores a late image load from the previous emotion', () => {
    const { rerender } = render(
      <SuspectPortrait theme="conac" archetype="doctor" emotion="calm" name="Dr. Ilie Strat" />,
    )
    const oldImage = images.at(-1)!
    rerender(
      <SuspectPortrait theme="conac" archetype="doctor" emotion="broken" name="Dr. Ilie Strat" />,
    )
    expectPortrait(suspects[0], 'broken')
    const draws = drawImage.mock.calls.length
    act(() => oldImage.onload?.())
    expect(drawImage).toHaveBeenCalledTimes(draws)
  })
})
describe('backend emotion updates with the real portrait component', () => {
  it.each(suspects)('updates $name through every emotion without refreshing', (suspect) => {
    seedScreen()
    const { container } = render(<InterrogationScreen onReturnToStation={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(suspect.name) }))
    const screenElement = container.querySelector('.interrogation')
    expectPortrait(suspect, 'calm')
    // Unique server IDs simulate teammate answers, including a return to calm.
    for (const [index, emotion] of [...emotions.slice(1), 'calm' as const].entries()) {
      deliverAnswer(answerFor(suspect.id, emotion, index))
      expectPortrait(suspect, emotion)
      expect(screen.getByText(`Current emotion: ${emotion}`)).toBeInTheDocument()
      expect(container.querySelector('.interrogation')).toBe(screenElement)
    }
  })
  it('keeps other suspects independent and shows their latest emotion when selected', () => {
    seedScreen()
    render(<InterrogationScreen onReturnToStation={vi.fn()} />)
    expectPortrait(suspects[0], 'calm')
    const loaded = images.length
    deliverAnswer(answerFor('victor', 'arrogant', 0))
    expect(images).toHaveLength(loaded)
    expect(screen.getByRole('img', { name: 'Dr. Ilie Strat, calm' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Victor Vornicu/ }))
    expectPortrait(suspects[2], 'arrogant')
    fireEvent.click(screen.getByRole('button', { name: /Dr. Ilie Strat/ }))
    expectPortrait(suspects[0], 'calm')
  })
  it('restores emotion from a snapshot and updates it when another snapshot arrives', () => {
    const snapshot = seedScreen()
    snapshot.interrogations[0].entries = [answerFor('strat', 'sad', 0).entry]
    useGameStore.getState().applySnapshot(snapshot)
    render(<InterrogationScreen onReturnToStation={vi.fn()} />)
    expectPortrait(suspects[0], 'sad')
    act(() => {
      useGameStore
        .getState()
        .applySnapshot({
          ...snapshot,
          interrogations: snapshot.interrogations.map((record) =>
            record.suspect === 'strat'
              ? { ...record, entries: [...record.entries, answerFor('strat', 'angry', 1).entry] }
              : record,
          ),
        })
    })
    expectPortrait(suspects[0], 'angry')
  })
})
