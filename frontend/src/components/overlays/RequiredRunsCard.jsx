export default function RequiredRunsCard({ state }) {
  if (state?.match?.currentInnings !== 2) return null
  const need = state.requiredRuns
  const balls = state.requiredBalls
  const rrr = state.requiredRunRate

  return (
    <div className="max-w-md rounded-2xl border border-amber-500/40 bg-[#0d1117]/98 px-6 py-5 text-center shadow-2xl transition-all duration-500 ease-out">
      <p className="text-sm uppercase tracking-wide text-amber-200/80">Required</p>
      <p className="mt-1 text-5xl font-black text-amber-400">{need ?? '—'}</p>
      <p className="mt-2 text-sm text-[#4a5568]">
        {balls != null ? `${balls} balls left` : ''} · RRR {rrr ?? '—'}
      </p>
    </div>
  )
}
