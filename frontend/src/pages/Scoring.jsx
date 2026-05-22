import { useCallback, useMemo, useState } from 'react'
import { useLiveKitAdminRoom } from '../hooks/useLiveKitAdminRoom'
import { useWebSocket } from '../hooks/useWebSocket'
import { useOverlaySync } from '../hooks/useOverlaySync'
import { useParams } from 'react-router-dom'
import { MatchProvider, useMatch } from '../context/MatchContext'
import { StreamProvider } from '../context/StreamContext'
import { OverlayProvider } from '../context/OverlayContext'
import Scoreboard from '../components/scoring/Scoreboard'
import RunButtons from '../components/scoring/RunButtons'
import ExtrasPanel from '../components/scoring/ExtrasPanel'
import WicketModal from '../components/scoring/WicketModal'
import OverControls from '../components/scoring/OverControls'
import BowlerModal from '../components/scoring/BowlerModal'
import UndoButton from '../components/scoring/UndoButton'
import AutoOverlayToggles from '../components/overlay-controls/AutoOverlayToggles'
import ManualOverlayPanel from '../components/overlay-controls/ManualOverlayPanel'
import RoomGuestsAdmin from '../components/scoring/RoomGuestsAdmin'
import AdminLiveKitPanel from '../components/scoring/AdminLiveKitPanel'
import AdminMatchLiveFeed from '../components/scoring/AdminMatchLiveFeed'
import { http, unwrap } from '../lib/http'
import { adminHeaders } from '../lib/adminHeaders'

function ScoringInner({ matchId }) {
  const { matchState, updateFromServer, refetch, matchLoading, matchError } = useMatch()
  const state = matchState
  const [busy, setBusy] = useState(false)
  const [runErr, setRunErr] = useState('')
  const [extraErr, setExtraErr] = useState('')
  const [wicketOpen, setWicketOpen] = useState(false)
  const [bowlerOpen, setBowlerOpen] = useState(false)
  const [controlModal, setControlModal] = useState(null)
  const [lkReconnectNonce, setLkReconnectNonce] = useState(0)
  const lk = useLiveKitAdminRoom({ matchId, enabled: true, reconnectNonce: lkReconnectNonce })

  const adminWsAuth = useMemo(() => {
    try {
      const tok = localStorage.getItem('criccast_admin_token')?.trim()
      if (tok) return { adminToken: tok, adminSecret: '' }
      const s = localStorage.getItem('criccast_admin_secret')?.trim()
      return { adminToken: '', adminSecret: s || '' }
    } catch {
      return { adminToken: '', adminSecret: '' }
    }
  }, [])

  const hasAdminWsCred = !!(adminWsAuth.adminToken || adminWsAuth.adminSecret)

  const overlayHandler = useOverlaySync()
  const handleWsMessage = useCallback(
    (msg) => {
      overlayHandler(msg)
    },
    [overlayHandler]
  )

  useWebSocket({
    matchId,
    enabled: !!matchId && !!state && hasAdminWsCred,
    adminToken: adminWsAuth.adminToken,
    adminSecret: adminWsAuth.adminSecret,
    onEvent: handleWsMessage,
  })

  const postBall = useCallback(
    async (body) => {
      setBusy(true)
      setRunErr('')
      setExtraErr('')
      try {
        const res = await http.post(`/api/match/${matchId}/ball`, body)
        const data = unwrap(res)
        updateFromServer(data)
      } catch (e) {
        const msg = e?.response?.data?.error || e.message
        if (body.type === 'WICKET' || ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE'].includes(body.type)) {
          setExtraErr(msg)
        } else {
          setRunErr(msg)
        }
        throw e
      } finally {
        setBusy(false)
      }
    },
    [matchId, updateFromServer]
  )

  const onRun = (n) => postBall({ type: 'RUN', runsOffBat: n })

  const onExtra = (x) => {
    if (x.type === 'WIDE') return postBall({ type: 'WIDE', extraRuns: x.extraRuns ?? 0 })
    if (x.type === 'NO_BALL') return postBall({ type: 'NO_BALL', runsOffBat: x.runsOffBat ?? 0 })
    if (x.type === 'BYE' || x.type === 'LEG_BYE') {
      return postBall({ type: x.type, runsOffBat: x.runsOffBat ?? 1 })
    }
  }

  const striker = state?.batting?.striker
  const t1 = state?.teams?.team1?.players || []
  const t2 = state?.teams?.team2?.players || []
  const bowlingPlayers = useMemo(() => {
    const sid = striker?.id
    if (t1.some((p) => p.id === sid)) return t2
    if (t2.some((p) => p.id === sid)) return t1
    return t2
  }, [striker?.id, t1, t2])

  const canEndOver = !!state?.innings?.pendingOverEnd

  const endOverWithBowler = async (nextBowlerId) => {
    setBusy(true)
    try {
      const res = await http.post(`/api/match/${matchId}/over/end`, { nextBowlerId })
      updateFromServer(unwrap(res))
      setBowlerOpen(false)
    } catch (e) {
      alert(e?.response?.data?.error || e.message)
    } finally {
      setBusy(false)
    }
  }

  const onUndo = async () => {
    setBusy(true)
    try {
      const res = await http.post(`/api/match/${matchId}/undo`)
      updateFromServer(unwrap(res))
    } catch (e) {
      alert(e?.response?.data?.error || e.message)
    } finally {
      setBusy(false)
    }
  }

  const postOverlay = async (type, extra = {}) => {
    await http.post(`/api/match/${matchId}/overlay`, { type, options: extra })
  }

  const postControl = async (action) => {
    const admin = adminHeaders()
    try {
      if (action === 'END') {
        const res = await http.post(`/api/match/${matchId}/complete`, {}, { headers: admin })
        updateFromServer(unwrap(res))
        alert('Match marked complete.')
      } else {
        await http.post(`/api/match/${matchId}/break`, { action }, { headers: admin })
        alert('Break recorded.')
      }
    } catch (e) {
      alert(e?.response?.data?.error || e.message || 'Action not supported by API')
    }
  }

  if (matchLoading && !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-[#4a5568]">
        Loading match…
      </div>
    )
  }

  if (matchError && !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4 text-[#f44336]">
        {matchError}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e0e0e0]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 py-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <Scoreboard state={state} />
          <RunButtons disabled={busy} onRun={onRun} error={runErr} />
          <ExtrasPanel
            disabled={busy}
            onExtra={onExtra}
            onWicketClick={() => setWicketOpen(true)}
            error={extraErr}
          />
          <OverControls
            thisOver={state?.bowling?.thisOver}
            canEndOver={canEndOver}
            onEndOver={() => setBowlerOpen(true)}
            undoSlot={<UndoButton disabled={busy} loading={busy} onUndo={onUndo} />}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { id: 'DRINKS', label: 'Drinks' },
              { id: 'INNINGS', label: 'Innings break' },
              { id: 'RAIN', label: 'Rain delay' },
              { id: 'RESUME', label: 'Resume' },
              { id: 'END', label: 'End match' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setControlModal(b.id)}
                className="rounded-lg border border-[#1a2030] py-3 text-xs font-medium"
              >
                {b.label}
              </button>
            ))}
          </div>

          <AdminMatchLiveFeed matchState={state} roomRef={lk.roomRef} connected={lk.connected} />
        </div>

        <div className="w-full shrink-0 space-y-4 lg:w-80">
          <RoomGuestsAdmin matchId={matchId} />
          <AdminLiveKitPanel
            lk={lk}
            onReconnectLiveKit={() => setLkReconnectNonce((n) => n + 1)}
          />
          <AutoOverlayToggles />
          <ManualOverlayPanel postOverlay={postOverlay} />
        </div>
      </div>

      <WicketModal
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        state={state}
        loading={busy}
        onConfirm={async (body) => {
          await postBall(body)
        }}
      />

      <BowlerModal
        open={bowlerOpen}
        onClose={() => setBowlerOpen(false)}
        players={bowlingPlayers}
        currentBowlerId={state?.bowling?.current?.id}
        loading={busy}
        onPick={(id) => endOverWithBowler(id)}
      />

      {controlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a2030] bg-[#0d1117] p-4">
            <p className="mb-3 text-sm text-[#4a5568]">Confirm this match control?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setControlModal(null)} className="flex-1 rounded-lg border border-[#1a2030] py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await postControl(controlModal)
                  setControlModal(null)
                  refetch()
                }}
                className="flex-1 rounded-lg bg-[#00e5ff] py-2 text-sm font-semibold text-[#0a0a0f]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Scoring() {
  const { matchId } = useParams()
  if (!matchId) return null

  return (
    <StreamProvider>
      <OverlayProvider>
        <MatchProvider matchId={matchId} matchAudience="admin">
          <ScoringInner matchId={matchId} />
        </MatchProvider>
      </OverlayProvider>
    </StreamProvider>
  )
}
