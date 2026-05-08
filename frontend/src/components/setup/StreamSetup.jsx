import { useState } from 'react'
import { useHLS } from '../../hooks/useHLS'
import { isWhepUrl, useWebRTCWhep } from '../../hooks/useWebRTCWhep'
import PlaybackTelemetryCard from '../viewer/PlaybackTelemetryCard'
import PlaybackVideoSurface from '../viewer/PlaybackVideoSurface'

export default function StreamSetup({ matchId, onGoLive, goLiveLoading }) {
  const [streamUrl, setStreamUrl] = useState('')
  const [streamKey, setStreamKey] = useState('')
  const [preview, setPreview] = useState(false)

  const activeUrl = preview ? streamUrl : null
  const whep = isWhepUrl(activeUrl || '')
  const hls = useHLS(!whep ? activeUrl : null, {})
  const rtc = useWebRTCWhep(whep ? activeUrl : null, {})

  const videoRef = whep ? rtc.videoRef : hls.videoRef
  const isLoading = whep ? rtc.isLoading : hls.isLoading
  const error = whep ? rtc.error : hls.error
  const retry = whep ? rtc.retry : hls.retry
  const showTelemetry = !!(preview && streamUrl)

  return (
    <div className="space-y-6 text-left">
      <div className="rounded-xl border border-[#1a2030] bg-[#0d1117] p-4 text-sm text-[#4a5568] space-y-2">
        <p className="font-medium text-[#e0e0e0]">Larix + MediaMTX (WebRTC viewer)</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Open Larix and create a new connection using RTMP/RTMPS.</li>
          <li>
            Larix publish URL:
            <div className="mt-1 space-y-0.5">
              <div>
                <code className="text-[#00e5ff]">rtmp://&lt;your-lan-ip&gt;:1935/live/&lt;streamKey&gt;</code>
              </div>
            </div>
          </li>
          <li>
            Run MediaMTX with <strong className="text-[#e0e0e0]">TCP 8889</strong> and{' '}
            <strong className="text-[#e0e0e0]">UDP 8189</strong> published (WebRTC). Set{' '}
            <code className="text-[#00e5ff]">webrtcAdditionalHosts</code> in <code>mediamtx.yml</code> to your Mac LAN IP
            so phones can connect.
          </li>
          <li>
            Paste the <strong>WHEP</strong> playback URL (low latency). Example:{' '}
            <code className="text-[#00e5ff]">http://&lt;your-lan-ip&gt;:8889/live/&lt;streamKey&gt;/whep</code>
          </li>
          <li className="text-[#4a5568]">
            Optional fallback: legacy HLS{' '}
            <code className="text-[#00e5ff]">…/index.m3u8</code> on port 8888 still works in the viewer if you paste that
            instead.
          </li>
          <li>Use Preview to verify video — telemetry is in the card under the preview.</li>
        </ol>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Playback URL (WHEP, required)</label>
        <input
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
          placeholder="http://<your-lan-ip>:8889/live/<streamKey>/whep"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Publisher stream key (required)</label>
        <input
          value={streamKey}
          onChange={(e) => setStreamKey(e.target.value)}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
          placeholder="Same key used by Larix publisher"
        />
        <p className="mt-1 text-xs text-[#4a5568]">
          Tip: when Larix runs on iPhone, do not use localhost; use your Mac LAN IP (e.g. 192.168.x.x).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="rounded-lg border border-[#1a2030] px-4 py-2 text-sm font-medium text-[#e0e0e0]"
        >
          {preview ? 'Stop preview' : 'Preview stream'}
        </button>
      </div>

      {preview && streamUrl && (
        <div className="mx-auto max-w-md space-y-3">
          <PlaybackVideoSurface
            videoRef={videoRef}
            isLoading={isLoading}
            error={error}
            retry={retry}
            hasSource
            idleLabel="No playback URL"
            controls
          />
          <PlaybackTelemetryCard
            show={showTelemetry}
            hlsActive={!whep}
            rtcActive={whep}
            hlsLines={hls.metricLines}
            rtcLines={rtc.metricLines}
            hlsInactiveHint={
              whep ? 'Preview uses WebRTC/WHEP URL — switch playback URL to an .m3u8 path for HLS metrics' : undefined
            }
            rtcInactiveHint={
              !whep
                ? 'Preview uses HLS (.m3u8) — paste a /whep URL for WebRTC telemetry'
                : undefined
            }
          />
        </div>
      )}

      <button
        type="button"
        disabled={goLiveLoading || !matchId}
        onClick={() => onGoLive({ streamUrl, streamKey })}
        className="w-full min-h-[48px] rounded-lg bg-[#ff3c3c] py-3 font-semibold text-white disabled:opacity-50"
      >
        {goLiveLoading ? 'Going live…' : 'Go Live'}
      </button>
    </div>
  )
}
