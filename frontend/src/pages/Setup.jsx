import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MatchDetailsForm from '../components/setup/MatchDetailsForm'
import TeamForm from '../components/setup/TeamForm'
import UmpireForm from '../components/setup/UmpireForm'
import TossForm from '../components/setup/TossForm'
import StreamSetup from '../components/setup/StreamSetup'
import { http, unwrap } from '../lib/http'

const LS_MATCH = 'criccast_last_match_id'

function battingSide(tossWinner, tossElected) {
  return tossWinner === 'team1'
    ? tossElected === 'bat'
      ? 'team1'
      : 'team2'
    : tossElected === 'bat'
      ? 'team2'
      : 'team1'
}

function orderInTeam(players, playerId) {
  const i = players.findIndex((p) => p.id === playerId)
  return i >= 0 ? i + 1 : null
}

export default function Setup() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('wizard')
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [goLiveLoading, setGoLiveLoading] = useState(false)
  const [matchId, setMatchId] = useState(() => localStorage.getItem(LS_MATCH) || '')

  const [details, setDetails] = useState({
    title: '',
    format: 'T20',
    totalOvers: 20,
    venue: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const [team1Name, setTeam1Name] = useState('')
  const [team1Players, setTeam1Players] = useState([])

  const [team2Name, setTeam2Name] = useState('')
  const [team2Players, setTeam2Players] = useState([])

  const [umpires, setUmpires] = useState({
    on1: '',
    on2: '',
    third: '',
    referee: '',
  })

  const [toss, setToss] = useState({ winner: 'team1', elected: 'bat' })
  const [opening, setOpening] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' })

  const mergeToss = useCallback((patch) => {
    setToss((t) => ({ ...t, ...patch }))
  }, [])

  const mergeOpening = useCallback((patch) => {
    setOpening((o) => ({ ...o, ...patch }))
  }, [])

  const canNext = useMemo(() => {
    if (step === 1) return details.title.trim() && (details.format === 'Test' || (details.totalOvers ?? 0) > 0)
    if (step === 2) return team1Name.trim() && team1Players.length >= 2
    if (step === 3) return team2Name.trim() && team2Players.length >= 2
    if (step === 4) return umpires.on1.trim() && umpires.on2.trim()
    if (step === 5) {
      return (
        opening.strikerId &&
        opening.nonStrikerId &&
        opening.bowlerId &&
        opening.strikerId !== opening.nonStrikerId
      )
    }
    return true
  }, [details, opening, step, team1Name, team1Players.length, team2Name, team2Players.length, umpires])

  const buildCreatePayload = useCallback(() => {
    const mapPlayers = (arr) =>
      arr.map((p, i) => ({
        name: p.name,
        jerseyNumber: p.jerseyNumber ?? null,
        role: p.role,
        battingOrder: i + 1,
        isCaptain: false,
        isWicketkeeper: p.role === 'WICKET_KEEPER',
      }))

    const bat = battingSide(toss.winner, toss.elected)
    const batPlayers = bat === 'team1' ? team1Players : team2Players
    const bowlPlayers = bat === 'team1' ? team2Players : team1Players

    return {
      title: details.title.trim(),
      format: details.format,
      totalOvers: details.format === 'Test' ? null : details.totalOvers,
      venue: details.venue.trim() || undefined,
      date: details.date,
      toss: { winner: toss.winner, elected: toss.elected },
      team1: { name: team1Name.trim(), players: mapPlayers(team1Players) },
      team2: { name: team2Name.trim(), players: mapPlayers(team2Players) },
      umpires: [
        { name: umpires.on1.trim(), role: 'ON_FIELD_1' },
        { name: umpires.on2.trim(), role: 'ON_FIELD_2' },
        ...(umpires.third.trim() ? [{ name: umpires.third.trim(), role: 'THIRD' }] : []),
        ...(umpires.referee.trim() ? [{ name: umpires.referee.trim(), role: 'REFEREE' }] : []),
      ],
      opening: {
        strikerBattingOrder: orderInTeam(batPlayers, opening.strikerId),
        nonStrikerBattingOrder: orderInTeam(batPlayers, opening.nonStrikerId),
        bowlerBattingOrder: orderInTeam(bowlPlayers, opening.bowlerId),
      },
    }
  }, [details, opening, team1Name, team1Players, team2Name, team2Players, toss, umpires])

  const onCreateMatch = async () => {
    setSubmitting(true)
    try {
      const res = await http.post('/api/match/create', buildCreatePayload())
      const data = unwrap(res)
      const id = data?.match?.id || data?.id
      if (!id) throw new Error('No match id in response')
      localStorage.setItem(LS_MATCH, id)
      setMatchId(id)
      setPhase('stream')
    } catch (e) {
      alert(e?.response?.data?.error || e.message || 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  const onGoLive = async ({ streamUrl, streamKey }) => {
    if (!matchId) return
    setGoLiveLoading(true)
    try {
      await http.post(`/api/match/${matchId}/stream`, { streamUrl, streamKey })
      await http.post(`/api/match/${matchId}/golive`)
      navigate(`/admin/${matchId}`)
    } catch (e) {
      alert(e?.response?.data?.error || e.message || 'Go live failed')
    } finally {
      setGoLiveLoading(false)
    }
  }

  if (phase === 'stream') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e0e0e0] px-4 py-8">
        <div className="mx-auto max-w-lg">
          <h1 className="mb-6 text-center text-2xl font-bold">Stream setup</h1>
          <p className="mb-4 text-center text-xs text-[#4a5568]">
            MediaMTX: Larix publishes RTMP; CricCast viewer uses WebRTC (WHEP on :8889). HLS on :8888 is optional.
          </p>
          <StreamSetup matchId={matchId} onGoLive={onGoLive} goLiveLoading={goLiveLoading} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e0e0e0] px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                step === n ? 'bg-[#00e5ff] text-[#0a0a0f]' : 'border border-[#1a2030] text-[#4a5568]'
              }`}
            >
              {n}
            </div>
          ))}
        </div>

        <h1 className="mb-6 text-center text-2xl font-bold">New match setup</h1>

        {step === 1 && <MatchDetailsForm value={details} onChange={setDetails} />}
        {step === 2 && (
          <TeamForm
            stepLabel="Team 1"
            teamName={team1Name}
            onTeamNameChange={setTeam1Name}
            players={team1Players}
            onPlayersChange={setTeam1Players}
          />
        )}
        {step === 3 && (
          <TeamForm
            stepLabel="Team 2"
            teamName={team2Name}
            onTeamNameChange={setTeam2Name}
            players={team2Players}
            onPlayersChange={setTeam2Players}
          />
        )}
        {step === 4 && <UmpireForm value={umpires} onChange={setUmpires} />}
        {step === 5 && (
          <TossForm
            team1Name={team1Name}
            team2Name={team2Name}
            team1Players={team1Players}
            team2Players={team2Players}
            tossWinner={toss.winner}
            tossElected={toss.elected}
            onTossChange={mergeToss}
            strikerId={opening.strikerId}
            nonStrikerId={opening.nonStrikerId}
            bowlerId={opening.bowlerId}
            onOpeningChange={mergeOpening}
          />
        )}

        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-lg border border-[#1a2030] py-3 font-medium"
            >
              Back
            </button>
          )}
          {step < 5 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 rounded-lg bg-[#00e5ff] py-3 font-semibold text-[#0a0a0f] disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext || submitting}
              onClick={onCreateMatch}
              className="flex-1 rounded-lg bg-[#00e5ff] py-3 font-semibold text-[#0a0a0f] disabled:opacity-40"
            >
              {submitting ? 'Creating…' : 'Create Match'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
