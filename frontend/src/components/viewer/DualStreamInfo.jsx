function Clip({ label, url }) {
  if (!url) return null
  return (
    <div className="rounded-lg border border-[#1a2030] bg-[#0a0a0f] p-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-[#4a5568]">{label}</div>
      <code className="mt-0.5 block break-all text-[11px] text-[#00e5ff]/90">{url}</code>
    </div>
  )
}

/**
 * Read-only stream endpoints (both players run at once).
 */
export default function DualStreamInfo({ hlsUrl, whepUrl, savedStreamUrl, streamKey }) {
  return (
    <div className="mb-3 rounded-xl border border-[#1a2030] bg-[#0d1117] p-3 text-sm">
      <p className="mb-2 font-semibold text-[#e0e0e0]">Stream endpoints</p>
      <p className="mb-3 text-xs leading-relaxed text-[#4a5568]">
        Two players load the same Larix feed: HLS (HTTP) and WebRTC (WHEP). Live chat prefers an RTC{' '}
        <code className="text-[#00e5ff]/80">DataChannel</code> through the CricCast server and falls back to the match
        WebSocket + Redis relay if WebRTC negotiation fails or is still connecting.
      </p>
      <div className="space-y-2 text-xs text-[#4a5568]">
        {streamKey && (
          <p>
            <span className="text-[#4a5568]">Stream key:</span> <code className="text-[#e0e0e0]">{streamKey}</code>
          </p>
        )}
        {savedStreamUrl && (
          <p className="break-all">
            <span className="text-[#4a5568]">Saved in match:</span>{' '}
            <code className="text-[#a0aec0]">{savedStreamUrl}</code>
          </p>
        )}
      </div>
      <div className="mt-3 space-y-2">
        <Clip label="HLS (.m3u8)" url={hlsUrl} />
        <Clip label="WebRTC (WHEP)" url={whepUrl} />
      </div>
    </div>
  )
}
