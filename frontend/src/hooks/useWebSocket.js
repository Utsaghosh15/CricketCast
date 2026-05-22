import { useEffect, useRef, useState, useCallback } from 'react'

const MAX_BACKOFF_MS = 8000

/**
 * WebSocket with exponential backoff reconnect and PING/PONG.
 * @param {{ matchId: string, enabled?: boolean, viewerToken?: string, adminToken?: string, adminSecret?: string, onEvent?: (msg: object) => void }} opts
 */
export function useWebSocket({
  matchId,
  enabled = true,
  viewerToken = '',
  adminToken = '',
  adminSecret = '',
  onEvent,
}) {
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const wsRef = useRef(null)
  const backoffRef = useRef(1000)
  const timerRef = useRef(null)
  const onEventRef = useRef(onEvent)
  const enabledRef = useRef(enabled)
  const matchIdRef = useRef(matchId)
  const viewerTokenRef = useRef(viewerToken)
  const adminTokenRef = useRef(adminToken)
  const adminSecretRef = useRef(adminSecret)
  const attemptsRef = useRef(0)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    enabledRef.current = enabled
    matchIdRef.current = matchId
    viewerTokenRef.current = viewerToken
    adminTokenRef.current = adminToken
    adminSecretRef.current = adminSecret

    if (!enabled || !matchId) {
      queueMicrotask(() => setIsConnected(false))
      return undefined
    }

    let cancelled = false

    const open = () => {
      if (cancelled || !enabledRef.current || !matchIdRef.current) return

      const mid = matchIdRef.current
      const base =
        import.meta.env.VITE_WS_URL ||
        (typeof window !== 'undefined'
          ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
          : '')
      const tok = viewerTokenRef.current
      const admTok = adminTokenRef.current
      const admSec = adminSecretRef.current

      const params = new URLSearchParams()
      params.set('matchId', mid)
      if (admTok) {
        params.set('role', 'admin')
        params.set('adminToken', admTok)
      } else if (admSec) {
        params.set('role', 'admin')
        params.set('adminSecret', admSec)
      } else {
        params.set('role', 'viewer')
        if (tok) params.set('viewerToken', tok)
      }
      const url = `${base}?${params.toString()}`

      try {
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          console.info('[CricCast WS] connected', mid)
          setIsConnected(true)
          backoffRef.current = 1000
          attemptsRef.current = 0
          setReconnectAttempts(0)
        }

        ws.onmessage = (ev) => {
          let msg
          try {
            msg = JSON.parse(ev.data)
          } catch {
            return
          }
          if (msg.type === 'PING') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PONG', t: msg.t }))
            }
            return
          }
          onEventRef.current?.(msg)
        }

        ws.onclose = () => {
          setIsConnected(false)
          wsRef.current = null
          if (cancelled || !enabledRef.current) return
          const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS)
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
          attemptsRef.current += 1
          setReconnectAttempts(attemptsRef.current)
          timerRef.current = window.setTimeout(open, delay)
        }

        ws.onerror = () => {
          // Actual reconnect happens in onclose; avoid surfacing noise until many failures.
        }
      } catch {
        timerRef.current = window.setTimeout(open, backoffRef.current)
      }
    }

    open()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, matchId, viewerToken, adminToken, adminSecret])

  const send = useCallback((obj) => {
    try {
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj))
        return true
      }
    } catch {
      /* ignore */
    }
    return false
  }, [])

  return { isConnected, reconnectAttempts, send }
}
