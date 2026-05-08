import { useEffect, useRef } from 'react'
import { formatEventTime } from '../../utils/timeUtils'

export default function MatchTimeline({ events }) {
  const topRef = useRef(null)

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  return (
    <aside className="flex max-h-[70vh] flex-col rounded-xl border border-[#1a2030] bg-[#0d1117] lg:max-h-[calc(100vh-8rem)]">
      <div className="border-b border-[#1a2030] px-3 py-2 text-sm font-semibold text-[#e0e0e0]">Match feed</div>
      <div className="flex-1 overflow-y-auto p-2">
        <div ref={topRef} />
        {(!events || events.length === 0) && (
          <p className="p-4 text-center text-sm text-[#4a5568]">Waiting for match to start…</p>
        )}
        <ul className="space-y-2">
          {events?.map((ev) => (
            <li key={ev.id} className="flex gap-2 rounded-lg border border-[#1a2030]/80 bg-[#0a0a0f]/80 px-2 py-2 text-xs">
              <span className="text-[#00e5ff]">{ev.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[#e0e0e0]">{ev.description}</p>
                <p className="text-[#4a5568]">
                  {ev.over ? `Over ${ev.over} · ` : ''}
                  {formatEventTime(ev.ts)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
