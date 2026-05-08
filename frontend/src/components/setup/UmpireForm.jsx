export default function UmpireForm({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v })

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">On-field umpire 1 *</label>
        <input
          required
          value={value.on1}
          onChange={(e) => set('on1', e.target.value)}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">On-field umpire 2 *</label>
        <input
          required
          value={value.on2}
          onChange={(e) => set('on2', e.target.value)}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Third umpire</label>
        <input
          value={value.third}
          onChange={(e) => set('third', e.target.value)}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Match referee</label>
        <input
          value={value.referee}
          onChange={(e) => set('referee', e.target.value)}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
        />
      </div>
    </div>
  )
}
