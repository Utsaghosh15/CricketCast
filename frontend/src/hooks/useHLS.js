import Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Target distance behind live edge (seconds). */
const LIVE_SYNC_DURATION_S = 4
/** If playback falls this far behind live, Hls.js seeks forward (must be > liveSyncDuration). */
const LIVE_MAX_LATENCY_S = 14
/** Cap forward buffer so the playhead cannot drift minutes behind on poor networks. */
const MAX_BUFFER_LENGTH_S = 20

const HLS_LIVE_CONFIG = {
  enableWorker: true,
  lowLatencyMode: true,
  maxBufferLength: MAX_BUFFER_LENGTH_S,
  liveSyncDuration: LIVE_SYNC_DURATION_S,
  liveMaxLatencyDuration: LIVE_MAX_LATENCY_S,
  maxLiveSyncPlaybackRate: 1.08,
}

function fmt(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

function bufferAheadSeconds(video) {
  if (!video?.buffered?.length) return null
  const end = video.buffered.end(video.buffered.length - 1)
  return Math.max(0, end - video.currentTime)
}

/**
 * @param {string|null|undefined} streamUrl
 * @param {{ setStreamLatency?: (n: number) => void }} [opts]
 */
export function useHLS(streamUrl, opts = {}) {
  const { setStreamLatency } = opts
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const tickRef = useRef(null)
  const [metrics, setMetrics] = useState(null)
  const [isLoading, setIsLoading] = useState(!!streamUrl)
  const [error, setError] = useState(null)
  const [currentLatency, setCurrentLatency] = useState(0)

  const attach = useCallback(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

    setError(null)
    setIsLoading(true)

    if (Hls.isSupported()) {
      const hls = new Hls(HLS_LIVE_CONFIG)
      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false)
        void video.play().catch(() => {})
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[HLS]', data)
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError()
              break
            default:
              setError('Stream error')
              setIsLoading(false)
              break
          }
        }
      })

      tickRef.current = window.setInterval(() => {
        const lat = typeof hls.latency === 'number' ? hls.latency : 0
        setCurrentLatency(lat)
        setStreamLatency?.(lat)
        const bw = hls.bandwidthEstimate
        setMetrics({
          latencyS: lat,
          targetLatencyS:
            typeof hls.targetLatency === 'number' && !Number.isNaN(hls.targetLatency)
              ? hls.targetLatency
              : null,
          maxLatencyS: typeof hls.maxLatency === 'number' ? hls.maxLatency : null,
          drift: typeof hls.drift === 'number' && !Number.isNaN(hls.drift) ? hls.drift : null,
          liveSyncPosition: hls.liveSyncPosition,
          bufferAheadS: bufferAheadSeconds(video),
          bwEstimateMbps: Number.isFinite(bw) ? bw / 1e6 : null,
          droppedFrames: video.getVideoPlaybackQuality?.()?.droppedVideoFrames ?? null,
          playbackRate: video.playbackRate,
        })
        // Safety: default Hls liveMaxLatencyDuration was Infinity; config should cap drift, but
        // force a jump if latency still grows (e.g. edge cases after long stalls).
        if (lat > LIVE_MAX_LATENCY_S + 3) {
          const pos = hls.liveSyncPosition
          if (pos != null && Number.isFinite(pos) && video.duration > pos) {
            video.currentTime = pos
          }
        }
      }, 1000)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false)
        void video.play().catch(() => {})
      }, { once: true })
      tickRef.current = window.setInterval(() => {
        const seekable = video.seekable
        let drift = 0
        if (seekable && seekable.length > 0) {
          const end = seekable.end(seekable.length - 1)
          drift = Math.max(0, end - video.currentTime)
          if (drift > LIVE_MAX_LATENCY_S) {
            video.currentTime = Math.max(seekable.start(0), end - LIVE_SYNC_DURATION_S)
          }
        }
        setCurrentLatency(drift)
        setStreamLatency?.(drift)
        setMetrics({
          latencyS: drift,
          targetLatencyS: null,
          maxLatencyS: LIVE_MAX_LATENCY_S,
          drift: null,
          liveSyncPosition: null,
          bufferAheadS: drift,
          bwEstimateMbps: null,
          droppedFrames: video.getVideoPlaybackQuality?.()?.droppedVideoFrames ?? null,
          playbackRate: video.playbackRate,
        })
      }, 1000)
    } else {
      setError('HLS not supported in this browser')
      setIsLoading(false)
    }
  }, [setStreamLatency, streamUrl])

  useEffect(() => {
    const videoElForCleanup = videoRef.current
    attach()
    return () => {
      setMetrics(null)
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (videoElForCleanup) {
        videoElForCleanup.removeAttribute('src')
        videoElForCleanup.load()
      }
    }
  }, [attach])

  const retry = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    attach()
  }, [attach])

  const metricLines = metrics
    ? [
        { label: 'Live latency', value: `${fmt(metrics.latencyS, 2)} s` },
        {
          label: 'Target Δ',
          value: metrics.targetLatencyS != null ? `${fmt(metrics.targetLatencyS, 2)} s` : '—',
        },
        { label: 'Max latency', value: metrics.maxLatencyS != null ? `${fmt(metrics.maxLatencyS, 2)} s` : '—' },
        { label: 'Drift', value: metrics.drift != null ? `${fmt(metrics.drift, 3)}` : '—' },
        {
          label: 'Buffer ahead',
          value: metrics.bufferAheadS != null ? `${fmt(metrics.bufferAheadS, 2)} s` : '—',
        },
        {
          label: 'ABR estimate',
          value: metrics.bwEstimateMbps != null ? `${fmt(metrics.bwEstimateMbps, 2)} Mb/s` : '—',
        },
        {
          label: 'Playback Δ',
          value: metrics.playbackRate != null ? `${fmt(metrics.playbackRate, 3)} ×` : '—',
        },
        {
          label: 'Dropped frm',
          value: metrics.droppedFrames != null ? String(metrics.droppedFrames) : '—',
        },
      ]
    : []

  return { videoRef, isLoading, error, currentLatency, retry, metrics, metricLines }
}