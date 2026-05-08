export default function TeamLineupCard({ state, variant, data }) {
  const inferred = data?.team === 'team2' ? 'TEAM_LINEUP_T2' : data?.team === 'team1' ? 'TEAM_LINEUP_T1' : variant
  const team =
    inferred === 'TEAM_LINEUP_T2' ? state?.teams?.team2 : inferred === 'TEAM_LINEUP_T1' ? state?.teams?.team1 : state?.teams?.team1
  const players = team?.players || []

  return (
    <div className="max-h-[70vh] w-full max-w-md overflow-auto rounded-xl border border-[#1a2030] bg-[#0d1117]/98 p-4 shadow-2xl transition-all duration-500 ease-out">
      <p className="mb-3 text-lg font-bold text-[#00e5ff]">{team?.name || 'Team'}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-[#e0e0e0]">
        {players.map((p, i) => (
          <li key={p.id}>
            {p.name}
            {p.is_captain ? ' (c)' : ''}
            {p.is_wicketkeeper || p.role === 'WICKET_KEEPER' ? ' (wk)' : ''}
          </li>
        ))}
      </ol>
    </div>
  )
}
