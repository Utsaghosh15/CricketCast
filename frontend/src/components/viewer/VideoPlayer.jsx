import { useStream } from '../../context/StreamContext'
import { useHLS } from '../../hooks/useHLS'
import { isWhepUrl, useWebRTCWhep } from '../../hooks/useWebRTCWhep'

export default function VideoPlayer({ streamUrl }) {
  const { setCurrentLatency } = useStream()
  const whep = isWhepUrl(streamUrl)

  const hls = useHLS(whep ? null : streamUrl, { setStreamLatency: setCurrentLatency })
  const rtc = useWebRTCWhep(whep ? streamUrl : null, { setStreamLatency: setCurrentLatency })

  const { videoRef, isLoading, error, retry } = whep ? rtc : hls

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#1a2030] bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        muted
        autoPlay
      />
      {isLoading && streamUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-[#00e5ff] border-t-transparent" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center text-sm text-[#f44336]">
          {error}
          <button type="button" onClick={retry} className="rounded-lg bg-[#00e5ff] px-4 py-2 text-[#0a0a0f]">
            Retry
          </button>
        </div>
      )}
      {!streamUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[#4a5568]">No stream URL yet</div>
      )}
    </div>
  )
}
