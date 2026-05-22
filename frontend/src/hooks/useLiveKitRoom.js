import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnectionState, Room, RoomEvent } from 'livekit-client'
import { http, unwrap } from '../lib/http'
import { LIVEKIT_CHAT_MSG_TYPE } from '../constants/livekitChat'

/** Wait until the RTC engine is in Connected (required before publish). */
async function waitUntilConnected(room, maxMs = 15000) {
  if (room.state === ConnectionState.Connected) return true
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (room.state === ConnectionState.Connected) return true
    await new Promise((r) => setTimeout(r, 120))
  }
  return room.state === ConnectionState.Connected
}

async function enableCameraWithRetries(room) {
  if (typeof room.startAudio === 'function') {
    await room.startAudio().catch(() => {})
  }
  let lastErr
  for (let attempt = 0; attempt < 6; attempt++) {
    const ok = await waitUntilConnected(room, 12000)
    if (!ok) throw new Error('LiveKit connection not ready')
    try {
      await room.localParticipant.setCameraEnabled(true)
      return
    } catch (e) {
      lastErr = e
      const msg = String(e?.message || e || '')
      if (!/engine not connected|timeout|not connected|reconnect|disconnected/i.test(msg)) throw e
      await new Promise((r) => setTimeout(r, 350 + attempt * 150))
    }
  }
  throw lastErr || new Error('Camera publish failed')
}

/**
 * LiveKit room: fan camera (no screen share) + chat relay.
 * @param {{ matchId: string, viewerJwt: string | null, enabled: boolean, reconnectNonce?: number }} opts
 */
export function useLiveKitRoom({ matchId, viewerJwt, enabled, reconnectNonce = 0 }) {
  const roomRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [canPublish, setCanPublish] = useState(false)
  const [messages, setMessages] = useState([])
  const seenRef = useRef(new Set())
  /** User wants camera on after LiveKit reconnects (region / ping recovery). */
  const desiredCameraRef = useRef(false)
  const canPublishRef = useRef(false)
  const lastCamRestoreAt = useRef(0)
  canPublishRef.current = canPublish

  const disconnect = useCallback(() => {
    desiredCameraRef.current = false
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

  const sendChat = useCallback(
    async (partial) => {
      if (!viewerJwt || !matchId) return false
      try {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}`
        await http.post(
          `/api/match/${matchId}/livekit/room-chat`,
          {
            id,
            displayName: partial.displayName,
            text: partial.text ?? null,
            emoji: partial.emoji ?? null,
          },
          { headers: { Authorization: `Bearer ${viewerJwt}` } }
        )
        return true
      } catch (e) {
        console.error('[lk chat send]', e)
        return false
      }
    },
    [viewerJwt, matchId]
  )

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
      return next.length > 120 ? next.slice(-120) : next
    })
  }, [])

  useEffect(() => {
    seenRef.current.clear()
    setMessages([])
  }, [matchId, viewerJwt, reconnectNonce])

  useEffect(() => {
    if (!enabled || !viewerJwt || !matchId) {
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

    /** SDK order: (prevPermissions, participant) — not (participant). */
    const onPermissionsChanged = (_prevPermissions, participant) => {
      if (!participant || participant !== room.localParticipant) return
      const perms = participant.permissions
      if (perms && perms.canPublish === false) {
        desiredCameraRef.current = false
        setCanPublish(false)
        void participant.setCameraEnabled(false).catch(() => {})
      }
    }
    room.on(RoomEvent.ParticipantPermissionsChanged, onPermissionsChanged)

    const tryResumeCameraAfterReconnect = () => {
      if (cancelled || !desiredCameraRef.current || !canPublishRef.current) return
      const now = Date.now()
      if (now - lastCamRestoreAt.current < 1800) return
      lastCamRestoreAt.current = now
      void (async () => {
        try {
          await waitUntilConnected(room, 15000)
          if (cancelled || roomRef.current !== room || !desiredCameraRef.current) return
          if (room.localParticipant.isCameraEnabled) return
          await enableCameraWithRetries(room)
        } catch (e) {
          console.warn('[lk] resume camera after reconnect', e?.message || e)
        }
      })()
    }

    const onConnectionStateChanged = () => {
      if (cancelled) return
      setConnected(room.state === ConnectionState.Connected)
      if (room.state === ConnectionState.Connected) tryResumeCameraAfterReconnect()
    }
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)

    const onReconnected = () => {
      tryResumeCameraAfterReconnect()
    }
    room.on(RoomEvent.Reconnected, onReconnected)

    async function run() {
      setError('')
      setConnecting(true)
      try {
        const res = await http.get(`/api/match/${matchId}/livekit/token`, {
          headers: { Authorization: `Bearer ${viewerJwt}` },
        })
        const data = unwrap(res)
        if (!data?.token || !data?.url) {
          throw new Error('Missing token or url from server')
        }
        setCanPublish(!!data.canPublish)
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
      room.off(RoomEvent.ParticipantPermissionsChanged, onPermissionsChanged)
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
      room.off(RoomEvent.Reconnected, onReconnected)
      try {
        room.disconnect()
      } catch {
        /* ignore */
      }
      if (roomRef.current === room) roomRef.current = null
      setConnected(false)
      setConnecting(false)
    }
  }, [matchId, viewerJwt, enabled, reconnectNonce, ingestPayload, disconnect])

  /** When host enables publish after connect, refresh token without tearing down PC longer than needed. */
  useEffect(() => {
    if (!enabled || !viewerJwt || !matchId || !connected || canPublish) return undefined

    const busyRef = { current: false }

    const tick = async () => {
      const room = roomRef.current
      if (!room || busyRef.current) return
      try {
        const res = await http.get(`/api/match/${matchId}/livekit/token`, {
          headers: { Authorization: `Bearer ${viewerJwt}` },
        })
        const data = unwrap(res)
        if (!data?.token || !data?.url || !data.canPublish) return

        busyRef.current = true
        const wantCam = !!room.localParticipant?.isCameraEnabled || desiredCameraRef.current
        if (wantCam) desiredCameraRef.current = true
        setCanPublish(true)
        try {
          await room.disconnect()
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 350))
        await room.connect(data.url, data.token)
        setConnected(room.state === ConnectionState.Connected)
        if (wantCam) {
          try {
            await waitUntilConnected(room, 15000)
            await enableCameraWithRetries(room)
          } catch (e) {
            console.warn('[lk grant] restore camera', e?.message || e)
          }
        }
      } catch (e) {
        console.warn('[lk grant poll]', e?.message || e)
      } finally {
        busyRef.current = false
      }
    }

    const w = typeof window !== 'undefined' ? window : null
    if (!w) return undefined
    const id = w.setInterval(() => void tick(), 12000)
    void tick()
    return () => {
      busyRef.current = false
      w.clearInterval(id)
    }
  }, [enabled, viewerJwt, matchId, connected, canPublish])

  /** If host revokes publish in DB, drop local camera + UI grant (LiveKit may also update via server). */
  useEffect(() => {
    if (!enabled || !viewerJwt || !matchId || !connected || !canPublish) return undefined

    const tick = async () => {
      const room = roomRef.current
      if (!room) return
      try {
        const res = await http.get(`/api/match/${matchId}/livekit/token`, {
          headers: { Authorization: `Bearer ${viewerJwt}` },
        })
        const data = unwrap(res)
        if (data?.canPublish) return
        setCanPublish(false)
        desiredCameraRef.current = false
        try {
          await room.localParticipant.setCameraEnabled(false)
        } catch {
          /* ignore */
        }
      } catch (e) {
        console.warn('[lk revoke poll]', e?.message || e)
      }
    }

    const w = typeof window !== 'undefined' ? window : null
    if (!w) return undefined
    const id = w.setInterval(() => void tick(), 22000)
    void tick()
    return () => w.clearInterval(id)
  }, [enabled, viewerJwt, matchId, connected, canPublish])

  const startCameraShare = useCallback(async () => {
    const room = roomRef.current
    if (!room || !canPublish) return
    desiredCameraRef.current = true
    try {
      if (room.state !== ConnectionState.Connected) {
        const ok = await waitUntilConnected(room, 15000)
        if (!ok) {
          desiredCameraRef.current = false
          setError('LiveKit is still connecting. Try Share camera again in a few seconds.')
          return
        }
      }
      await enableCameraWithRetries(room)
    } catch (e) {
      desiredCameraRef.current = false
      console.error('[lk camera]', e)
      setError((e && e.message) || 'Camera failed')
    }
  }, [canPublish])

  const stopCameraShare = useCallback(async () => {
    desiredCameraRef.current = false
    const room = roomRef.current
    if (!room) return
    try {
      await room.localParticipant.setCameraEnabled(false)
    } catch (e) {
      console.error('[lk camera stop]', e)
    }
  }, [])

  return {
    roomRef,
    connected,
    connecting,
    error,
    canPublish,
    messages,
    sendChat,
    disconnect,
    startCameraShare,
    stopCameraShare,
  }
}
