import { useCallback, useRef, useState } from 'react'

const MAX = 120

/** Append inbound CHAT_MESSAGE payloads into a capped list */
export function useMatchChatFeed() {
  const [messages, setMessages] = useState([])
  const seenRef = useRef(new Set())

  const ingest = useCallback((payload) => {
    if (!payload || payload.type !== 'CHAT_MESSAGE') return
    const id = typeof payload.id === 'string' ? payload.id : null
    if (id && seenRef.current.has(id)) return
    if (id) seenRef.current.add(id)

    const row = {
      id: id || `local-${payload.ts}-${Math.random().toString(36).slice(2, 10)}`,
      displayName: payload.displayName || 'Fan',
      text: payload.text || null,
      emoji: payload.emoji || null,
      ts: typeof payload.ts === 'number' ? payload.ts : Date.now(),
    }
    setMessages((prev) => {
      const next = [...prev, row]
      return next.length > MAX ? next.slice(-MAX) : next
    })
  }, [])

  return { messages, ingest }
}
