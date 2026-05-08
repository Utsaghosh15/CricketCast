export default function CustomMessageCard({ data }) {
  return (
    <div className="max-w-xl rounded-2xl border border-[#1a2030] bg-[#0d1117]/98 px-6 py-8 text-center shadow-2xl transition-all duration-500 ease-out">
      <p className="text-2xl font-bold leading-snug text-[#e0e0e0] md:text-3xl">{data?.message || ''}</p>
    </div>
  )
}
