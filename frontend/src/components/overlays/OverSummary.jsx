export default function OverSummary({ data }) {
  return (
    <div className="mx-auto max-w-md px-4 transition-all duration-500 ease-out">
      <div className="rounded-xl border border-[#00e5ff]/30 bg-[#0d1117]/95 px-4 py-3 text-center shadow-xl">
        <p className="text-sm font-semibold text-[#00e5ff]">End of over {data?.overNumber ?? ''}</p>
        <p className="text-xs text-[#4a5568]">
          This over: {data?.runsThisOver ?? 0} runs · {data?.wicketsThisOver ?? 0} wkts
        </p>
        <p className="mt-1 text-sm text-[#e0e0e0]">{data?.scoreFull || data?.score || ''}</p>
      </div>
    </div>
  )
}
