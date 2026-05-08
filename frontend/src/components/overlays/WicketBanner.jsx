export default function WicketBanner({ data }) {
  const name = data?.playerOut || data?.batsman || ''
  const runs = data?.runs ?? 0
  const balls = data?.balls ?? 0
  return (
    <div className="max-w-lg rounded-2xl border border-[#f44336]/40 bg-[#0d1117]/95 px-8 py-6 text-center shadow-2xl transition-all duration-500 ease-out">
      <p className="text-3xl font-black text-[#f44336] md:text-4xl">OUT!</p>
      <p className="mt-2 text-lg font-bold text-[#e0e0e0]">
        {name} {runs} ({balls}b)
      </p>
      <p className="mt-1 text-sm text-[#4a5568]">
        {data?.dismissalType || data?.dismissal || ''} · {data?.bowler || ''}
      </p>
      <p className="mt-1 text-xs text-[#4a5568]">{data?.score || ''}</p>
    </div>
  )
}
