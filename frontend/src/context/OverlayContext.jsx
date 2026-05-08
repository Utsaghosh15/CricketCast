import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const LS_AUTO = 'criccast_overlay_auto_v1'

const defaultAuto = {
  six: true,
  four: true,
  wicket: true,
  overSummary: true,
  scoreUpdate: true,
}

function readAutoSettings() {
  try {
    const raw = localStorage.getItem(LS_AUTO)
    if (!raw) return { ...defaultAuto }
    return { ...defaultAuto, ...JSON.parse(raw) }
  } catch {
    return { ...defaultAuto }
  }
}

const OverlayContext = createContext(null)

export function OverlayProvider({ children }) {
  const [activeBanner, setActiveBanner] = useState(null)
  const [activeCard, setActiveCard] = useState(null)
  const [timelineEvents, setTimelineEvents] = useState([])
  const [autoSettings, setAutoSettingsState] = useState(readAutoSettings)
  const [scoreFlashKey, setScoreFlashKey] = useState(0)

  useEffect(() => {
    localStorage.setItem(LS_AUTO, JSON.stringify(autoSettings))
  }, [autoSettings])

  const setAutoSettings = useCallback((patch) => {
    setAutoSettingsState((s) => ({ ...s, ...patch }))
  }, [])

  const pushTimeline = useCallback((row) => {
    setTimelineEvents((prev) => [{ ...row, id: `${Date.now()}-${prev.length}` }, ...prev].slice(0, 200))
  }, [])

  const clearAllOverlays = useCallback(() => {
    setActiveBanner(null)
    setActiveCard(null)
  }, [])

  const flashScoreBug = useCallback(() => {
    setScoreFlashKey((k) => k + 1)
  }, [])

  const value = useMemo(
    () => ({
      activeBanner,
      setActiveBanner,
      activeCard,
      setActiveCard,
      timelineEvents,
      pushTimeline,
      autoSettings,
      setAutoSettings,
      clearAllOverlays,
      scoreFlashKey,
      flashScoreBug,
    }),
    [
      activeBanner,
      activeCard,
      timelineEvents,
      pushTimeline,
      autoSettings,
      setAutoSettings,
      clearAllOverlays,
      scoreFlashKey,
      flashScoreBug,
    ]
  )

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
}

export function useOverlay() {
  const ctx = useContext(OverlayContext)
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider')
  return ctx
}
