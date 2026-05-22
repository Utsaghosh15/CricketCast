/**
 * Main match stream (HLS / WHEP): viewer-reaction chrome (start → live, optional end).
 * @param {{ phase: 'none' | 'starting' | 'live' | 'ending', hideEnding?: boolean }} props
 */
export default function FanCamMomentOverlay({ phase, hideEnding = false }) {
  if (phase === 'none' || (hideEnding && phase === 'ending')) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[22] overflow-hidden rounded-lg"
      aria-live="polite"
      data-reaction-phase={phase}
    >
      {phase === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px] transition-opacity duration-500">
          <div className="absolute inset-3 rounded-lg border-2 border-[#00e5ff]/50 shadow-[0_0_24px_rgba(0,229,255,0.25)] animate-pulse" />
          <div className="relative z-10 max-w-md px-6 text-center">
            <div
              className="mx-auto mb-4 h-14 w-14 rounded-full border-4 border-[#00e5ff]/20 border-t-[#00e5ff] animate-spin"
              style={{ animationDuration: '1s' }}
            />
            <p className="text-lg font-semibold tracking-tight text-white">Viewer reaction</p>
            <p className="mt-2 text-sm text-white/85">Starting on the main stream…</p>
          </div>
        </div>
      )}

      {phase === 'live' && (
        <>
          <div className="absolute inset-0 rounded-lg ring-2 ring-inset ring-[#00e5ff]/30" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-3">
            <div className="flex items-center justify-center gap-2 px-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00e5ff] opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00e5ff]" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00e5ff]">Viewer reaction · live</p>
            </div>
            <p className="mt-1 text-center text-[10px] text-white/60">Fan camera is up — match keeps playing above.</p>
          </div>
        </>
      )}

      {phase === 'ending' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] transition-opacity duration-700">
          <div className="relative max-w-md px-6 text-center">
            <p className="text-4xl" aria-hidden>
              🙏
            </p>
            <p className="mt-4 text-lg font-semibold text-white">Viewer reaction ended</p>
            <p className="mt-2 text-sm text-white/85">Thanks — back to the match as normal.</p>
          </div>
        </div>
      )}
    </div>
  )
}
