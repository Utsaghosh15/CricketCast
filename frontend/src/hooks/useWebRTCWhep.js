import { useCallback, useEffect, useRef, useState } from 'react'
import { MediaMTXWebRTCReader } from '../lib/mediamtxWebRTCReader'

/** Playback URL is MediaMTX WHEP endpoint (…/path/whep). */
export function isWhepUrl(url) {
  return typeof url === 'string' && url.includes('/whep')
}

const envLat = import.meta.env.VITE_WEBRTC_ASSUMED_LATENCY_S
const ASSUMED_LATENCY_S =
  envLat !== undefined && envLat !== '' && !Number.isNaN(Number(envLat)) ? Number(envLat) : 0.4

function fmt(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

/**
 * @param {RTCStatsReport} report
 * @param {{ t: number, bytes: number, frames: number }|null} prev
 */
function aggregateWebRtcStats(report, prev) {
  const now = Date.now() / 1000
  const dt = prev && now - prev.t > 0.05 ? now - prev.t : 0

  let rttS = null
  let jitterS = null
  let bytesRecv = null
  let framesDecoded = null
  let frameWidth = null
  let frameHeight = null
  let packetsLost = null
  let packetsReceived = null

  report.forEach((r) => {
    const t = r.type
    if ((t === 'candidate-pair' || t === 'webrtc-candidate-pair') && (r.nominated === true || r.state === 'succeeded')) {
      const v = r.currentRoundTripTime
      if (typeof v === 'number' && !Number.isNaN(v)) rttS = v
    }
    if (t === 'inbound-rtp' && r.kind === 'video') {
      if (typeof r.jitter === 'number') jitterS = r.jitter
      if (typeof r.bytesReceived === 'number') bytesRecv = r.bytesReceived
      if (typeof r.framesDecoded === 'number') framesDecoded = r.framesDecoded
      if (typeof r.frameWidth === 'number') frameWidth = r.frameWidth
      if (typeof r.frameHeight === 'number') frameHeight = r.frameHeight
      if (typeof r.packetsLost === 'number') packetsLost = r.packetsLost
      if (typeof r.packetsReceived === 'number') packetsReceived = r.packetsReceived
    }
  })

  let bitrateMbps = null
  let fps = null
  if (prev && dt > 0 && bytesRecv != null && prev.bytes != null) {
    const dBytes = bytesRecv - prev.bytes
    if (dBytes >= 0) bitrateMbps = (dBytes * 8) / dt / 1e6
  }
  if (prev && dt > 0 && framesDecoded != null && prev.frames != null) {
    const df = framesDecoded - prev.frames
    if (df >= 0) fps = df / dt
  }

  const nextPrev = { t: now, bytes: bytesRecv ?? prev?.bytes ?? 0, frames: framesDecoded ?? prev?.frames ?? 0 }

  const latencyEstimateS =
    rttS != null
      ? Math.min(8, Math.max(0.08, rttS * 0.55 + Math.min(jitterS || 0, 0.2)))
      : ASSUMED_LATENCY_S

  return {
    nextPrev,
    latencyEstimateS,
    rttMs: rttS != null ? rttS * 1000 : null,
    jitterMs: jitterS != null ? jitterS * 1000 : null,
    bitrateMbps,
    fps,
    frameWidth,
    frameHeight,
    packetsLost,
    packetsReceived,
  }
}

/**
 * Low-latency playback via WebRTC (WHEP) — pairs with Larix→RTMP→MediaMTX ingest.
 *
 * @param {string|null|undefined} whepUrl
 * @param {{ setStreamLatency?: (n: number) => void }} [opts]
 */
export function useWebRTCWhep(whepUrl, opts = {}) {
  const { setStreamLatency } = opts
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const statsPrevRef = useRef(null)
  const [isLoading, setIsLoading] = useState(!!whepUrl)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [metrics, setMetrics] = useState(null)

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1)
    setError(null)
  }, [])

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !whepUrl || !isWhepUrl(whepUrl)) {
      setIsLoading(false)
      setStreamLatency?.(0)
      setMetrics(null)
      statsPrevRef.current = null
      return undefined
    }

    setIsLoading(true)
    setError(null)
    setMetrics(null)
    statsPrevRef.current = null

    readerRef.current?.close()
    readerRef.current = null

    const reader = new MediaMTXWebRTCReader({
      url: whepUrl,
      user: '',
      pass: '',
      token: '',
      onError: (err) => {
        console.error('[WebRTC]', err)
        setError(String(err))
        setIsLoading(false)
      },
      onTrack: (evt) => {
        const stream = evt.streams[0]
        if (!stream) return
        videoEl.srcObject = stream
        setIsLoading(false)
        setStreamLatency?.(ASSUMED_LATENCY_S)
        void videoEl.play().catch(() => {})
      },
    })
    readerRef.current = reader

    const pollStats = async () => {
      try {
        const pc = reader.getPeerConnection?.()
        if (!pc || pc.connectionState === 'closed') return
        const report = await pc.getStats()
        const agg = aggregateWebRtcStats(report, statsPrevRef.current)
        statsPrevRef.current = agg.nextPrev
        setStreamLatency?.(agg.latencyEstimateS)
        setMetrics({
          latencyEstimateS: agg.latencyEstimateS,
          rttMs: agg.rttMs,
          jitterMs: agg.jitterMs,
          bitrateMbps: agg.bitrateMbps,
          fps: agg.fps,
          resolution:
            agg.frameWidth && agg.frameHeight ? `${agg.frameWidth}×${agg.frameHeight}` : null,
          packetsLost: agg.packetsLost,
          packetsReceived: agg.packetsReceived,
          connectionState: pc.connectionState,
          iceState: pc.iceConnectionState,
        })
      } catch {
        /* ignore */
      }
    }

    const tick = window.setInterval(() => {
      void pollStats()
    }, 1000)

    return () => {
      clearInterval(tick)
      reader.close()
      readerRef.current = null
      videoEl.srcObject = null
      statsPrevRef.current = null
      setMetrics(null)
    }
  }, [whepUrl, retryCount, setStreamLatency])

  const metricLines = metrics
    ? [
        { label: 'Est. glass', value: `${fmt(metrics.latencyEstimateS, 2)} s` },
        { label: 'RTT', value: metrics.rttMs != null ? `${fmt(metrics.rttMs, 0)} ms` : '—' },
        { label: 'Jitter', value: metrics.jitterMs != null ? `${fmt(metrics.jitterMs, 1)} ms` : '—' },
        { label: 'Bitrate', value: metrics.bitrateMbps != null ? `${fmt(metrics.bitrateMbps, 2)} Mb/s` : '—' },
        { label: 'FPS', value: metrics.fps != null ? `${fmt(metrics.fps, 1)}` : '—' },
        { label: 'Video', value: metrics.resolution || '—' },
        { label: 'Lost pkts', value: metrics.packetsLost != null ? String(metrics.packetsLost) : '—' },
        { label: 'ICE / PC', value: `${metrics.iceState} · ${metrics.connectionState}` },
      ]
    : []

  return { videoRef, isLoading, error, retry, metrics, metricLines }
}
