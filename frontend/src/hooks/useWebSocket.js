import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_BACKOFF_MS = 8000

/**
 * WebSocket with exponential backoff reconnect and PING/PONG.
 * @param {{ matchId: string, enabled?: boolean, onEvent?: (msg: object) => void }} opts
 */
export function useWebSocket({ matchId, enabled = true, onEvent }) {
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const wsRef = useRef(null)
  const backoffRef = useRef(1000)
  const timerRef = useRef(null)
  const onEventRef = useRef(onEvent)
  const matchIdRef = useRef(matchId)
  const attemptsRef = useRef(0)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    matchIdRef.current = matchId
  }, [matchId])

  const connect = useCallback(() => {
    if (!enabled || !matchId) return

    const base = import.meta.env.VITE_WS_URL || ''
    const url = `${base}?matchId=${encodeURIComponent(matchId)}&role=viewer`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.info('[CricCast WS] connected', matchId)
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
        if (!enabled) return
        const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS)
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
        attemptsRef.current += 1
        setReconnectAttempts(attemptsRef.current)
        timerRef.current = window.setTimeout(connect, delay)
      }

      ws.onerror = () => {
        // Actual reconnect happens in onclose; avoid surfacing noise until many failures.
      }
    } catch {
      timerRef.current = window.setTimeout(connect, backoffRef.current)
    }
  }, [enabled, matchId])

  useEffect(() => {
    if (!enabled || !matchId) {
      setIsConnected(false)
      return undefined
    }
    connect()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect, enabled, matchId])

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
