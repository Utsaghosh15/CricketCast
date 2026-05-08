export default function FourBanner({ data }) {
  return (
    <div className="max-w-lg rounded-2xl border border-[#ffb300]/40 bg-[#0d1117]/95 px-8 py-6 text-center shadow-2xl transition-all duration-500 ease-out">
      <p className="text-4xl font-black text-[#ffb300] md:text-5xl">FOUR!</p>
      <p className="mt-2 text-xl font-bold text-[#e0e0e0]">{data?.batsman || ''}</p>
      <p className="mt-1 text-sm text-[#4a5568]">{data?.score || ''}</p>
    </div>
  )
}
