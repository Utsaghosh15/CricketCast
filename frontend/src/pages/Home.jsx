import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { http, unwrap } from '../lib/http'
import { formatScoreLine } from '../utils/cricketUtils'

function normalizeLists(raw) {
  if (!raw) return { live: [], recent: [] }
  if (Array.isArray(raw)) {
    const live = raw.filter((m) => m.status === 'LIVE')
    const recent = raw.filter((m) => m.status === 'COMPLETE')
    return { live, recent }
  }
  return {
    live: raw.live || raw.matches?.filter((m) => m.status === 'LIVE') || [],
    recent: raw.recent || raw.matches?.filter((m) => m.status === 'COMPLETE') || [],
  }
}

function MatchCard({ m, showPulse }) {
  const score =
    m.scoreSummary ||
    (m.innings ? formatScoreLine(m.innings) : m.shortScore) ||
    (m.runs != null ? `${m.runs}/${m.wickets}` : '')

  return (
    <Link
      to={`/watch/${m.id}`}
      className="block rounded-xl border border-[#1a2030] bg-[#0d1117] p-4 text-left transition hover:border-[#00e5ff]/40"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-[#e0e0e0]">{m.title || 'Untitled match'}</h3>
        {showPulse && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#ff3c3c]/15 px-2 py-0.5 text-xs font-medium text-[#ff3c3c]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff3c3c] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff3c3c]" />
            </span>
            LIVE
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-[#4a5568]">
        {m.teamNames || `${m.team1Name || ''} vs ${m.team2Name || ''}`}
        {score ? ` · ${score}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {m.format && (
          <span className="rounded bg-[#1a2030] px-2 py-0.5 text-xs text-[#00e5ff]">{m.format}</span>
        )}
      </div>
    </Link>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [live, setLive] = useState([])
  const [recent, setRecent] = useState([])
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await http.get('/api/matches/live')
      const body = unwrap(res)
      const { live: L, recent: R } = normalizeLists(body)
      setLive(L)
      setRecent(R)
      setError(null)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
      setLive([])
      setRecent([])
    }
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e0e0e0]">
      <header className="border-b border-[#1a2030] bg-[#0d1117]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-[#00e5ff]">Cric</span>Cast
          </h1>
          <button
            type="button"
            onClick={() => navigate('/setup')}
            className="rounded-lg bg-[#00e5ff] px-4 py-2 text-sm font-semibold text-[#0a0a0f]"
          >
            + Create New Match
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        {error && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Could not load matches: {error}
          </p>
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold text-[#e0e0e0]">Live Matches</h2>
          {live.length === 0 ? (
            <p className="text-sm text-[#4a5568]">No live matches right now.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {live.map((m) => (
                <MatchCard key={m.id} m={m} showPulse />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-[#e0e0e0]">Recent Matches</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-[#4a5568]">No completed matches yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {recent.map((m) => (
                <MatchCard key={m.id} m={m} showPulse={false} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
