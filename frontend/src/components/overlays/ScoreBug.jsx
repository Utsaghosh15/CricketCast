import { useEffect, useState } from 'react'
import { currentRunRate, formatScoreLine } from '../../utils/cricketUtils'

export default function ScoreBug({ data, flashKey }) {
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (flashKey == null || flashKey === 0) return
    setFlash(true)
    const t = window.setTimeout(() => setFlash(false), 1500)
    return () => clearTimeout(t)
  }, [flashKey])

  if (!data?.match) return null

  const inn = data.innings
  const sid = data.batting?.striker?.id
  const t1 = data.teams?.team1
  const t2 = data.teams?.team2
  const batName =
    sid && t1?.players?.some((p) => p.id === sid) ? t1?.name : sid && t2?.players?.some((p) => p.id === sid) ? t2?.name : t1?.name

  const rr = inn ? currentRunRate(inn) : 0
  const second = data.match.currentInnings === 2 && data.target != null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 border-t border-[#1a2030] bg-[#0a0a0f]/95 px-3 py-2 backdrop-blur-sm transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="min-w-0">
          <span className="font-semibold text-[#00e5ff]">{batName}</span>
          <span className={`ml-2 font-mono text-lg font-bold text-[#e0e0e0] transition-colors duration-300 ${flash ? 'text-[#00e5ff]' : ''}`}>
            {inn ? formatScoreLine(inn) : '—'}
          </span>
        </div>
        <div className="text-xs text-[#4a5568]">RR {rr}</div>
        {second && (
          <div className="text-xs text-amber-300">
            Tgt {data.target} · need {data.requiredRuns ?? '—'}
          </div>
        )}
      </div>
    </div>
  )
}
