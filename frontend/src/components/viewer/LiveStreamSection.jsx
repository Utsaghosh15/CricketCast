import { useStream } from '../../context/StreamContext'
import { useHLS } from '../../hooks/useHLS'
import { useWebRTCWhep } from '../../hooks/useWebRTCWhep'
import OverlayManager from '../overlays/OverlayManager'
import PlaybackTelemetryCard from './PlaybackTelemetryCard'
import PlaybackVideoSurface from './PlaybackVideoSurface'

/**
 * Dual viewers: HLS + WebRTC side by side; score overlays align to WebRTC (low-latency) timing.
 * Telemetry is shown in a card below the videos (not overlaid on picture).
 *
 * @param {{ hlsUrl: string, whepUrl: string }} props
 */
export default function LiveStreamSection({ hlsUrl, whepUrl }) {
  const { setCurrentLatency } = useStream()
  const hls = useHLS(hlsUrl || null, {})
  const rtc = useWebRTCWhep(whepUrl || null, { setStreamLatency: setCurrentLatency })

  const hasAny = !!(hlsUrl || whepUrl)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#4a5568]">HLS · TCP 8888</p>
          <PlaybackVideoSurface
            videoRef={hls.videoRef}
            isLoading={hls.isLoading}
            error={hls.error}
            retry={hls.retry}
            hasSource={!!hlsUrl}
            idleLabel="No HLS URL"
          />
        </div>
        <div className="relative">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#00e5ff]/80">
            WebRTC · TCP 8889 + UDP
          </p>
          <p className="mb-2 text-[10px] text-[#4a5568]">Overlays sync to this feed.</p>
          <PlaybackVideoSurface
            videoRef={rtc.videoRef}
            isLoading={rtc.isLoading}
            error={rtc.error}
            retry={rtc.retry}
            hasSource={!!whepUrl}
            idleLabel="No WHEP URL"
          />
          <OverlayManager />
        </div>
      </div>

      <PlaybackTelemetryCard
        show={hasAny}
        hlsActive={!!hlsUrl}
        rtcActive={!!whepUrl}
        hlsLines={hls.metricLines}
        rtcLines={rtc.metricLines}
        hlsInactiveHint={!hlsUrl ? 'No HLS URL for this match' : undefined}
        rtcInactiveHint={!whepUrl ? 'No WHEP URL for this match' : undefined}
      />
    </div>
  )
}
