import { useCallback, useEffect, useRef, useState } from 'react'

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }]
const LABEL = 'criccast-chat'

function iceToPlain(candidate) {
  if (!candidate) return null
  if (typeof candidate.toJSON === 'function') return candidate.toJSON()
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment,
  }
}

/**
 * WebRTC DataChannel for match chat — WebSocket is only SDP/ICE signalling.
 *
 * @param {{
 *   matchId: string
 *   wsConnected: boolean
 *   send: (obj: object) => boolean
 *   onInbound: (payload: object) => void
 * }} opts
 */
export function useChatDataChannel({ matchId, wsConnected, send, onInbound }) {
  const [dcState, setDcState] = useState('idle')
  const [dcError, setDcError] = useState(null)

  const pcRef = useRef(null)
  const dcRef = useRef(null)
  const ingestRef = useRef(onInbound)
  const queuedServerIceRef = useRef([])

  useEffect(() => {
    ingestRef.current = onInbound
  }, [onInbound])

  const handleSignal = useCallback(async (msg) => {
    const pc = pcRef.current
    if (!pc || !msg) return
    try {
      if (msg.type === 'DC_CHAT_ERROR') {
        setDcState('failed')
        setDcError(typeof msg.error === 'string' ? msg.error : 'Chat channel failed')
        return
      }
      if (msg.type === 'DC_CHAT_ANSWER' && typeof msg.sdp === 'string') {
        await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
        const batch = queuedServerIceRef.current.splice(0)
        for (const c of batch) {
          await pc.addIceCandidate(new RTCIceCandidate(c))
        }
        return
      }
      if (msg.type === 'DC_CHAT_CANDIDATE' && msg.candidate) {
        if (!pc.remoteDescription) {
          queuedServerIceRef.current.push(msg.candidate)
          return
        }
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
      }
    } catch (e) {
      console.error('[dc chat]', e)
      setDcState('failed')
      setDcError(String(e.message || e))
    }
  }, [])

  useEffect(() => {
    queuedServerIceRef.current = []
    let cancelled = false

    if (!matchId || !wsConnected || !send) {
      dcRef.current = null
      pcRef.current = null
      queueMicrotask(() => {
        if (cancelled) return
        setDcState('idle')
        setDcError(null)
      })
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (cancelled) return
      setDcState('connecting')
      setDcError(null)

      const pc = new RTCPeerConnection({ iceServers: ICE })
      pcRef.current = pc

      const dc = pc.createDataChannel(LABEL, { ordered: true })
      dcRef.current = dc

      dc.onopen = () => setDcState('open')
      dc.onclose = () => setDcState((s) => (s === 'failed' ? s : 'closed'))
      dc.onmessage = (ev) => {
        try {
          const p = JSON.parse(String(ev.data))
          ingestRef.current?.(p)
        } catch {
          /* ignore */
        }
      }

      pc.onicecandidate = (e) => {
        if (!e.candidate) return
        const plain = iceToPlain(e.candidate)
        if (!plain) return
        send({
          type: 'DC_CHAT_CANDIDATE',
          matchId,
          candidate: plain,
        })
      }

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState
        if (st === 'failed' || st === 'disconnected') {
          setDcState('failed')
          setDcError((prev) => prev || 'Peer connection interrupted')
        }
      }

      void (async () => {
        if (cancelled) return
        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          const ok = send({
            type: 'DC_CHAT_OFFER',
            matchId,
            sdp: offer.sdp,
          })
          if (!ok) {
            setDcState('failed')
            setDcError('WebSocket not ready — cannot negotiate data channel')
          }
        } catch (e) {
          console.error('[dc chat] offer', e)
          setDcState('failed')
          setDcError(String(e.message || e))
        }
      })()
    })

    return () => {
      cancelled = true
      queuedServerIceRef.current = []
      const pc = pcRef.current
      try {
        pc?.close()
      } catch {
        /* ignore */
      }
      pcRef.current = null
      dcRef.current = null
      queueMicrotask(() => {
        setDcState('idle')
        setDcError(null)
      })
    }
  }, [matchId, wsConnected, send])

  const sendChatPayload = useCallback((partial) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return false
    try {
      dc.send(JSON.stringify(partial))
      return true
    } catch {
      return false
    }
  }, [])

  return { dcState, dcError, handleSignal, sendChatPayload }
}
