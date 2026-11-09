import { useEffect, useState } from 'react'
import type { ThemeMap } from '../contracts/theme-map'
import { fetchThemeMap } from './api'

interface MapState {
  theme: string
  map?: ThemeMap
  error?: string
}

export function useThemeMap(theme: string | undefined) {
  const [state, setState] = useState<MapState>()

  useEffect(() => {
    if (!theme) return
    const controller = new AbortController()
    fetchThemeMap(theme, controller.signal)
      .then((map) => {
        if (!controller.signal.aborted) setState({ theme, map })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ theme, error: 'Could not load the room map.' })
        }
      })
    return () => controller.abort()
  }, [theme])

  return state?.theme === theme ? state : undefined
}
