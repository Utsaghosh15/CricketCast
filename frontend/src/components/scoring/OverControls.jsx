function ballLabel(b) {
  if (!b) return '·'
  if (b.type === 'WIDE') return b.totalRuns > 1 ? `Wd${b.totalRuns - 1}` : 'Wd'
  if (b.type === 'NO_BALL') return 'Nb'
  if (b.type === 'WICKET') return 'W'
  if (b.runsOffBat != null && b.type === 'RUN') return String(b.runsOffBat)
  if (b.totalRuns != null && b.type !== 'RUN') return String(b.totalRuns)
  return '·'
}

function ballClass(b) {
  if (!b) return 'border-[#1a2030] text-[#4a5568]'
  if (b.type === 'WICKET') return 'border-[#f44336] bg-[#f44336]/20 text-[#f44336]'
  if (b.type === 'WIDE') return 'border-[#ffb300] bg-[#ffb300]/15 text-[#ffb300]'
  if (b.type === 'NO_BALL') return 'border-orange-400 bg-orange-400/15 text-orange-300'
  return 'border-[#1a2030] text-[#e0e0e0]'
}

export default function OverControls({ thisOver, canEndOver, onEndOver, undoSlot }) {
  const balls = thisOver || []

  return (
    <div className="rounded-xl border border-[#1a2030] bg-[#0d1117] p-3">
      <p className="mb-2 text-xs uppercase text-[#4a5568]">This over</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const b = balls[i]
          return (
            <div
              key={i}
              className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-bold ${ballClass(b)}`}
            >
              {ballLabel(b)}
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canEndOver}
          onClick={onEndOver}
          className="flex-1 rounded-lg bg-[#00e5ff] py-3 text-sm font-semibold text-[#0a0a0f] disabled:opacity-40"
        >
          End over
        </button>
        {undoSlot}
      </div>
    </div>
  )
}
