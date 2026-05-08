const BTNS = [
  { n: 0, cls: 'bg-[#1a2030] text-[#e0e0e0]' },
  { n: 1, cls: 'bg-[#0d1117] border border-[#1a2030] text-[#e0e0e0]' },
  { n: 2, cls: 'bg-[#0d1117] border border-[#1a2030] text-[#e0e0e0]' },
  { n: 3, cls: 'bg-[#0d1117] border border-[#1a2030] text-[#e0e0e0]' },
  { n: 4, cls: 'bg-[#ffb300]/20 border border-[#ffb300] text-[#ffb300]' },
  { n: 6, cls: 'bg-[#00e676]/15 border border-[#00e676] text-[#00e676]' },
]

export default function RunButtons({ disabled, onRun, error }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {BTNS.map(({ n, cls }) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onRun(n)}
            className={`min-h-[64px] rounded-xl text-xl font-bold ${cls} disabled:opacity-40`}
          >
            {n}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-[#f44336]">{error}</p>}
    </div>
  )
}
