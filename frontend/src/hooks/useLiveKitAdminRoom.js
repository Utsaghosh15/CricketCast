import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, ConnectionState } from 'livekit-client'
import { http, unwrap } from '../lib/http'
import { adminHeaders } from '../lib/adminHeaders'
import { LIVEKIT_CHAT_MSG_TYPE } from '../constants/livekitChat'

/**
 * Admin joins the match LiveKit room read-only to receive chat + remote tracks.
 * @param {{ matchId: string, enabled: boolean, reconnectNonce?: number }} opts
 */
export function useLiveKitAdminRoom({ matchId, enabled, reconnectNonce = 0 }) {
  const roomRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const seenRef = useRef(new Set())

  const disconnect = useCallback(() => {
    const r = roomRef.current
    roomRef.current = null
    if (r) {
      try {
        r.disconnect()
      } catch {
        /* ignore */
      }
    }
    setConnected(false)
    setConnecting(false)
  }, [])

  const ingestPayload = useCallback((raw, participant, localIdentity) => {
    let p
    try {
      p = JSON.parse(raw)
    } catch {
      return
    }
    if (p.type !== LIVEKIT_CHAT_MSG_TYPE) return
    if (p.id && seenRef.current.has(p.id)) return
    if (p.id) seenRef.current.add(p.id)
    const displayName = p.displayName || participant?.name || participant?.identity || localIdentity || 'Fan'
    setMessages((prev) => {
      const row = {
        id: p.id || `m-${p.ts}-${Math.random()}`,
        displayName,
        text: p.text || null,
        emoji: p.emoji || null,
        ts: typeof p.ts === 'number' ? p.ts : Date.now(),
      }
      const next = [...prev, row]
      return next.length > 200 ? next.slice(-200) : next
    })
  }, [])

  useEffect(() => {
    seenRef.current.clear()
    setMessages([])
  }, [matchId, reconnectNonce])

  useEffect(() => {
    if (!enabled || !matchId) {
      disconnect()
      return undefined
    }

    let cancelled = false
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room

    const onData = (payload, participant) => {
      const text = new TextDecoder().decode(payload)
      ingestPayload(text, participant, room.localParticipant?.identity || '')
    }
    room.on(RoomEvent.DataReceived, onData)

    const onConnectionStateChanged = () => {
      if (cancelled) return
      setConnected(room.state === ConnectionState.Connected)
    }
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)

    async function run() {
      setError('')
      setConnecting(true)
      try {
        const res = await http.get(`/api/match/${matchId}/livekit/admin-token`, { headers: adminHeaders() })
        const data = unwrap(res)
        if (!data?.token || !data?.url) throw new Error('Missing token or url from server')
        await room.connect(data.url, data.token)
        if (cancelled) {
          room.disconnect()
          return
        }
        setConnected(room.state === ConnectionState.Connected)
      } catch (e) {
        const msg = e?.response?.data?.error || e?.message || 'Connect failed'
        if (!cancelled) setError(String(msg))
        disconnect()
      } finally {
        if (!cancelled) setConnecting(false)
      }
    }

    void run()

    return () => {
      cancelled = true
      room.off(RoomEvent.DataReceived, onData)
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
      try {
        room.disconnect()
      } catch {
        /* ignore */
      }
      if (roomRef.current === room) roomRef.current = null
      setConnected(false)
      setConnecting(false)
    }
  }, [matchId, enabled, reconnectNonce, ingestPayload, disconnect])

  return {
    roomRef,
    connected,
    connecting,
    error,
    messages,
    disconnect,
  }
}
