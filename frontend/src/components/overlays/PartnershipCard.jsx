export default function PartnershipCard({ state }) {
  const s = state?.batting?.striker
  const n = state?.batting?.nonStriker
  const inn = state?.innings
  if (!s || !n) return null
  const runs = (s.runs || 0) + (n.runs || 0)
  const balls = (s.balls || 0) + (n.balls || 0)
  const rr = balls ? Math.round((runs / balls) * 600) / 10 : 0

  return (
    <div className="w-64 rounded-xl border border-[#1a2030] bg-[#0d1117]/98 p-3 shadow-xl transition-all duration-500 ease-out">
      <p className="text-xs font-semibold uppercase text-[#4a5568]">Partnership</p>
      <p className="mt-1 text-sm text-[#e0e0e0]">
        {s.name} <span className="text-[#4a5568]">&</span> {n.name}
      </p>
      <p className="mt-1 text-lg font-bold text-[#00e5ff]">
        {runs} ({balls}b) · RR {rr}
      </p>
    </div>
  )
}
