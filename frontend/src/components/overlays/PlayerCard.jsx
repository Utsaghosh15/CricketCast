export default function PlayerCard({ state, variant }) {
  const bat = state?.batting?.striker
  const bowl = state?.bowling?.current
  const showBowl =
    variant === 'PLAYER_CARD_BOWL' ||
    variant === 'PLAYER_CARD_BOWLER' ||
    variant === 'BOWLING_CARD'

  const subject = showBowl ? bowl : bat
  if (!subject) return null

  return (
    <div className="w-72 max-w-[90vw] rounded-xl border border-[#00e5ff]/30 bg-[#0d1117]/98 p-4 shadow-2xl transition-all duration-500 ease-out translate-x-0 opacity-100">
      <p className="text-lg font-bold text-[#e0e0e0]">{subject.name}</p>
      {showBowl ? (
        <div className="mt-3 space-y-1 text-sm text-[#4a5568]">
          <p>
            Overs {subject.overs}.{subject.balls} · Runs {subject.runs} · Wkts {subject.wickets}
          </p>
          <p>Econ {subject.economy}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-1 text-sm text-[#4a5568]">
          <p>
            Runs {subject.runs} · Balls {subject.balls} · SR {subject.strikeRate}
          </p>
        </div>
      )}
    </div>
  )
}
