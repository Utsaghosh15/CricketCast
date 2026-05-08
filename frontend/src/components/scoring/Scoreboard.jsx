import { currentRunRate, formatScoreLine, oversFloat, strikeRate } from '../../utils/cricketUtils'

function bowlerLine(b) {
  if (!b) return '—'
  const of = oversFloat(b.overs, b.balls)
  const oversStr = `${b.overs}.${b.balls}`
  return `${b.name} ${oversStr}-${0}-${b.runs}-${b.wickets}`
}

export default function Scoreboard({ state }) {
  if (!state?.match) return null

  const inn = state.innings
  const sid = state.batting?.striker?.id
  const t1 = state.teams?.team1
  const t2 = state.teams?.team2
  const batTeam =
    sid && t1?.players?.some((p) => p.id === sid) ? t1?.name : sid && t2?.players?.some((p) => p.id === sid) ? t2?.name : t1?.name
  const rr = inn ? currentRunRate(inn) : 0
  const s = state.batting?.striker
  const n = state.batting?.nonStriker
  const bow = state.bowling?.current
  const targetLine =
    state.match.currentInnings === 2 && state.target != null
      ? `Target ${state.target} · need ${state.requiredRuns ?? '—'} @ ${state.requiredRunRate ?? '—'} · ${state.requiredBalls ?? '—'} balls`
      : null

  return (
    <div className="space-y-2 rounded-xl border border-[#1a2030] bg-[#0d1117] p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-[#00e5ff]">{batTeam || 'Batting'}</span>
        <span className="text-lg font-bold text-[#e0e0e0]">{inn ? formatScoreLine(inn) : '—'}</span>
        <span className="text-[#4a5568]">RR {rr}</span>
      </div>
      {targetLine && <p className="text-xs text-amber-300">{targetLine}</p>}
      {s && (
        <p className="text-[#e0e0e0]">
          <span className="text-[#00e5ff]">*</span> {s.name} {s.runs}* ({s.balls}b) SR:{strikeRate(s.runs, s.balls)}
        </p>
      )}
      {n && (
        <p className="text-[#4a5568]">
          {n.name} {n.runs} ({n.balls}b)
        </p>
      )}
      {bow && <p className="text-xs text-[#4a5568]">{bowlerLine(bow)}</p>}
    </div>
  )
}
