/** @param {{ title: string, lines: Array<{ label: string, value: string }>, active: boolean, inactiveHint?: string }} props */
function TelemetryColumn({ title, lines, active, inactiveHint }) {
  if (!active) {
    return (
      <div className="rounded-lg border border-dashed border-[#1a2030]/80 bg-[#0a0a0f]/50 px-3 py-2 opacity-90">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#4a5568]">{title}</p>
        <p className="font-mono text-[10px] text-[#4a5568]">{inactiveHint || 'Inactive'}</p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#00e5ff]/85">{title}</p>
      {lines.length === 0 ? (
        <p className="font-mono text-[10px] text-[#4a5568]">Waiting for metrics…</p>
      ) : (
        <div className="space-y-1 font-mono">
          {lines.map(({ label, value }) => (
            <div key={label} className="flex items-baseline justify-between gap-4 text-[10px]">
              <span className="shrink-0 text-[#8899aa]">{label}</span>
              <span className="min-w-0 truncate text-right tabular-nums text-emerald-100/95">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Full-width telemetry card below stream(s).
 * @param {{
 *   hlsLines: Array<{label: string, value: string}>
 *   rtcLines: Array<{label: string, value: string}>
 *   show: boolean
 *   hlsActive: boolean
 *   rtcActive: boolean
 *   hlsInactiveHint?: string
 *   rtcInactiveHint?: string
 * }} props
 */
export default function PlaybackTelemetryCard({
  hlsLines,
  rtcLines,
  show,
  hlsActive,
  rtcActive,
  hlsInactiveHint,
  rtcInactiveHint,
}) {
  if (!show) return null

  return (
    <div className="rounded-xl border border-[#1a2030] bg-[#0d1117] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#e0e0e0]">Playback telemetry</h3>
        <p className="text-[10px] text-[#4a5568]">
          ~1&nbsp;s refresh · estimates only (not guaranteed glass-to-glass)
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TelemetryColumn
          title="HLS · TCP 8888"
          lines={hlsLines}
          active={hlsActive}
          inactiveHint={hlsInactiveHint}
        />
        <TelemetryColumn
          title="WebRTC · WHEP · 8889 + UDP"
          lines={rtcLines}
          active={rtcActive}
          inactiveHint={rtcInactiveHint}
        />
      </div>
    </div>
  )
}
