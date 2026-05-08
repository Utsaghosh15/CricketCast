export default function ScorecardCard({ state }) {
  const inn = state?.innings
  const battingTeam =
    state?.batting?.striker && state?.teams?.team1?.players?.some((p) => p.id === state.batting.striker.id)
      ? state.teams.team1
      : state?.teams?.team2

  const rows = (battingTeam?.players || []).slice(0, 11)

  return (
    <div className="max-h-[70vh] w-full max-w-lg overflow-auto rounded-xl border border-[#1a2030] bg-[#0d1117]/98 p-4 shadow-2xl transition-all duration-500 ease-out">
      <p className="mb-2 text-sm font-semibold text-[#00e5ff]">{battingTeam?.name || 'Batting'}</p>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-[#4a5568]">
            <th className="py-1">Player</th>
            <th className="py-1">R</th>
            <th className="py-1">B</th>
            <th className="py-1">4s</th>
            <th className="py-1">6s</th>
            <th className="py-1">SR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-[#1a2030] text-[#e0e0e0]">
              <td className="py-1 pr-2">{p.name}</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 border-t border-[#1a2030] pt-2 text-sm font-bold text-[#e0e0e0]">
        Total {inn?.runs ?? 0}/{inn?.wickets ?? 0} ({inn?.oversDisplay ?? '0.0'})
      </p>
      <p className="text-[10px] text-[#4a5568]">Live cards use server payload when available; fallback shows squad.</p>
    </div>
  )
}
