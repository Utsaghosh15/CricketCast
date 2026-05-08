export default function BowlingCard({ state }) {
  const b = state?.bowling?.current
  return (
    <div className="w-full max-w-md rounded-xl border border-[#1a2030] bg-[#0d1117]/98 p-4 shadow-2xl transition-all duration-500 ease-out">
      <p className="text-sm font-semibold text-[#00e5ff]">Bowling</p>
      {b ? (
        <p className="mt-2 text-lg font-bold text-[#e0e0e0]">{b.name}</p>
      ) : (
        <p className="text-[#4a5568]">—</p>
      )}
      {b && (
        <p className="mt-1 text-sm text-[#4a5568]">
          {b.overs}.{b.balls} ov · {b.runs} runs · {b.wickets} wkts · Econ {b.economy}
        </p>
      )}
    </div>
  )
}
