/** Shared chrome for HLS / WebRTC playback tiles (no metrics on video). */
export default function PlaybackVideoSurface({
  videoRef,
  isLoading,
  error,
  retry,
  hasSource,
  idleLabel,
  controls = false,
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#1a2030] bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        muted
        autoPlay
        controls={controls}
      />
      {isLoading && hasSource && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#00e5ff] border-t-transparent" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-3 text-center text-xs text-[#f44336]">
          {error}
          <button type="button" onClick={retry} className="rounded bg-[#00e5ff] px-3 py-1 text-[#0a0a0f]">
            Retry
          </button>
        </div>
      )}
      {!hasSource && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-[#4a5568]">{idleLabel}</div>
      )}
    </div>
  )
}
