import { useEffect, useRef, useState } from 'react'
import type { Emotion } from '../contracts/game-api'

const portraits = import.meta.glob<string>('../../../themes/*/portraits/*/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
})
const sets: Record<string, string> = {
  doctor: 'dr_ilie_strat/dr_strat',
  housekeeper: 'ana_muresan/ana_muresan',
  heir: 'victor_vornicu/victor_vornicu',
  lady: 'elena_vornicu/elena_vornicu',
}

/** Existing portraits are green-screen plates. Key them at runtime, preserving source assets. */
export function SuspectPortrait({
  theme,
  archetype,
  emotion,
  name,
}: {
  theme: string
  archetype: string
  emotion: Emotion
  name: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const prefix = `../../../themes/${theme}/portraits/${sets[archetype]}`
  const src = portraits[`${prefix}_${emotion}.webp`] ?? portraits[`${prefix}_calm.webp`]
  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled || !canvas.current) return
      const target = canvas.current
      target.width = image.naturalWidth
      target.height = image.naturalHeight
      const context = target.getContext('2d', { willReadFrequently: true })
      if (!context) {
        setFailed(true)
        return
      }
      try {
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(0, 0, target.width, target.height)
        for (let i = 0; i < pixels.data.length; i += 4) {
          const [r, g, b] = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]]
          if (g > 100 && g > r * 1.4 && g > b * 1.4) pixels.data[i + 3] = 0
        }
        context.putImageData(pixels, 0, 0)
        setFailed(false)
      } catch {
        setFailed(true)
      }
    }
    image.onerror = () => {
      if (!cancelled) setFailed(true)
    }
    if (src) image.src = src
    return () => {
      cancelled = true
    }
  }, [src])
  return (
    <>
      <canvas
        ref={canvas}
        className="interrogation-portrait"
        role="img"
        aria-label={`${name}, ${emotion}`}
        hidden={!src || failed}
      />
      {(!src || failed) && (
        <p className="interrogation-portrait-fallback">Portrait unavailable for {name}.</p>
      )}
    </>
  )
}
