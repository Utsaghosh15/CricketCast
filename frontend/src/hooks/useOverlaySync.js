import { useCallback, useEffect, useRef } from 'react'
import { useMatch } from '../context/MatchContext'
import { useOverlay } from '../context/OverlayContext'
import { useStream } from '../context/StreamContext'

const BANNER_MS = {
  SIX: 5000,
  FOUR: 4000,
  WICKET: 7000,
  OVER_SUMMARY: 5000,
  OVER_END: 5000,
}

const CARD_MS = {
  BATTING_SCORECARD: 8000,
  SCORECARD: 8000,
  BOWLING_FIGURES: 8000,
  BOWLING_CARD: 8000,
  PLAYER_CARD: 7000,
  PLAYER_CARD_BAT: 7000,
  PLAYER_CARD_BOWL: 7000,
  TEAM_LINEUP: 10000,
  TEAM_LINEUP_T1: 10000,
  TEAM_LINEUP_T2: 10000,
  UMPIRES: 6000,
  UMPIRES_CARD: 6000,
  PARTNERSHIP: 6000,
  REQUIRED_RUNS: 6000,
  CUSTOM_MESSAGE: 8000,
}

function nowPlus(ms) {
  return Date.now() + ms
}

const MANUAL_TYPES = new Set([
  'BATTING_SCORECARD',
  'BOWLING_FIGURES',
  'PLAYER_CARD',
  'PLAYER_CARD_BAT',
  'PLAYER_CARD_BOWL',
  'PLAYER_CARD_BATSMAN',
  'PLAYER_CARD_BOWLER',
  'TEAM_LINEUP',
  'TEAM_LINEUP_T1',
  'TEAM_LINEUP_T2',
  'UMPIRES',
  'UMPIRES_CARD',
  'PARTNERSHIP',
  'REQUIRED_RUNS',
  'CUSTOM_MESSAGE',
  'SCORECARD',
])

/**
 * Returns a handler for WebSocket JSON messages that drives overlays and score bug.
 *
 * Latency alignment: live video lags behind real-time scoring. For auto highlights
 * (sixes, fours, wickets, dot replays, over summaries, score bug updates), we delay
 * firing by `latencyRef.current` seconds so graphics line up with the HLS picture.
 * Manual scorer-triggered cards bypass delay and show immediately.
 */
export function useOverlaySync() {
  const { latencyRef } = useStream()
  const { updateFromServer } = useMatch()
  const {
    autoSettings,
    setActiveBanner,
    setActiveCard,
    clearAllOverlays,
    pushTimeline,
    flashScoreBug,
  } = useOverlay()

  const settingsRef = useRef(autoSettings)
  useEffect(() => {
    settingsRef.current = autoSettings
  }, [autoSettings])

  return useCallback(
    (msg) => {
      if (!msg || typeof msg !== 'object') return

      if (msg.type === 'MATCH_STATE' && msg.data) {
        updateFromServer(msg.data)
        return
      }

      // Backend WS fanout wraps events as { channel, payload }, where payload holds the real event.
      const event =
        msg.payload && typeof msg.payload === 'object' && msg.payload.type
          ? msg.payload
          : msg

      const t = event.type
      const payload = event.payload ?? event.data ?? event

      const cardAlias = {
        PLAYER_CARD_BATSMAN: 'PLAYER_CARD_BAT',
        PLAYER_CARD_BOWLER: 'PLAYER_CARD_BOWL',
      }

      if (t === 'HIDE_ALL') {
        clearAllOverlays()
        return
      }

      const isManualOverlay = event.triggeredBy === 'MANUAL' || MANUAL_TYPES.has(t)

      const triggerOverlay = (eventType, data, mode) => {
        const st = settingsRef.current
        const desc = `${eventType}${data?.batsman ? ` — ${data.batsman}` : ''}`

        if (mode === 'banner') {
          if (eventType === 'SIX' && !st.six) return
          if (eventType === 'FOUR' && !st.four) return
          if (eventType === 'WICKET' && !st.wicket) return
          if ((eventType === 'OVER_SUMMARY' || eventType === 'OVER_END') && !st.overSummary) return

          const ms = BANNER_MS[eventType] ?? 4000
          setActiveBanner({ type: eventType, data: data || {}, expiresAt: nowPlus(ms) })
        } else if (mode === 'card') {
          const normalizedType = cardAlias[eventType] || eventType
          const ms =
            typeof data?.durationMs === 'number'
              ? data.durationMs
              : typeof data?.duration === 'number'
                ? data.duration * 1000
                : CARD_MS[normalizedType] ?? CARD_MS[eventType] ?? 7000
          setActiveCard({ type: normalizedType, data: data || {}, expiresAt: nowPlus(ms) })
        }

        pushTimeline({
          icon: '●',
          description: desc,
          over: data?.overNumber != null ? String(data.overNumber) : data?.score ?? '',
          ts: Date.now(),
        })
      }

      const schedule = (fn) => {
        const delayMs = (latencyRef.current || 0) * 1000
        window.setTimeout(fn, delayMs)
      }

      if (t === 'SCORE_UPDATE' && payload?.state) {
        schedule(() => {
          if (!settingsRef.current.scoreUpdate) return
          updateFromServer(payload.state)
          flashScoreBug()
        })
        return
      }

      if (isManualOverlay) {
        const inner = payload?.type && payload !== event ? payload : event
        const cardType = inner.type || t
        const data = inner.payload ?? inner
        triggerOverlay(cardType, data, 'card')
        return
      }

      if (['SIX', 'FOUR', 'WICKET', 'DOT'].includes(t)) {
        schedule(() => triggerOverlay(t, payload, 'banner'))
        return
      }

      if (t === 'OVER_END' || t === 'OVER_SUMMARY') {
        schedule(() => triggerOverlay('OVER_END', payload, 'banner'))
      }
    },
    [
      clearAllOverlays,
      flashScoreBug,
      latencyRef,
      pushTimeline,
      setActiveBanner,
      setActiveCard,
      updateFromServer,
    ]
  )
}
