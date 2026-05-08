export default function UmpiresCard({ state }) {
  const list = state?.umpires || []
  return (
    <div className="w-64 max-w-[85vw] rounded-lg border border-[#1a2030] bg-[#0d1117]/98 p-3 text-xs shadow-xl transition-all duration-500 ease-out">
      <p className="mb-2 font-semibold uppercase tracking-wide text-[#4a5568]">Match officials</p>
      <ul className="space-y-1 text-[#e0e0e0]">
        {list.map((u, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="text-[#4a5568]">{u.role}</span>
            <span className="text-right">{u.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
