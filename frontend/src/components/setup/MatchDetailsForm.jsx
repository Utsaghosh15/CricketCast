const FORMATS = ['T20', 'ODI', 'Test', 'Custom']

export default function MatchDetailsForm({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })

  const onFormat = (f) => {
    if (f === 'T20') set({ format: f, totalOvers: 20 })
    else if (f === 'ODI') set({ format: f, totalOvers: 50 })
    else if (f === 'Test') set({ format: f, totalOvers: null })
    else set({ format: f, totalOvers: value.totalOvers || 20 })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Match title *</label>
        <input
          required
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
          placeholder="e.g. India vs Australia — 1st T20I"
        />
      </div>

      <div>
        <span className="mb-2 block text-sm text-[#4a5568]">Format</span>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFormat(f)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                value.format === f
                  ? 'bg-[#00e5ff] text-[#0a0a0f]'
                  : 'border border-[#1a2030] bg-[#0d1117] text-[#e0e0e0]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {value.format !== 'Test' && (
        <div>
          <label className="mb-1 block text-sm text-[#4a5568]">Total overs</label>
          <input
            type="number"
            min={1}
            max={999}
            value={value.totalOvers ?? ''}
            onChange={(e) => set({ totalOvers: Number(e.target.value) || null })}
            className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Venue</label>
        <input
          value={value.venue}
          onChange={(e) => set({ venue: e.target.value })}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
          placeholder="Optional"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Date</label>
        <input
          type="date"
          value={value.date}
          onChange={(e) => set({ date: e.target.value })}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
        />
      </div>
    </div>
  )
}
