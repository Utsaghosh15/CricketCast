export default function SixBanner({ data }) {
  return (
    <div className="max-w-lg rounded-2xl border border-[#00e676]/40 bg-[#0d1117]/95 px-8 py-6 text-center shadow-2xl transition-all duration-500 ease-out translate-y-0 opacity-100">
      <p className="text-4xl font-black text-[#00e676] md:text-5xl">⬆ SIX!</p>
      <p className="mt-2 text-xl font-bold text-[#e0e0e0]">{data?.batsman || ''}</p>
      <p className="mt-1 text-sm text-[#4a5568]">{data?.score || ''}</p>
    </div>
  )
}
