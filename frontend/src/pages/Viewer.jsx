import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MatchProvider, useMatch } from '../context/MatchContext'
import { OverlayProvider, useOverlay } from '../context/OverlayContext'
import { StreamProvider, useStream } from '../context/StreamContext'
import DualStreamInfo from '../components/viewer/DualStreamInfo'
import LiveStreamSection from '../components/viewer/LiveStreamSection'
import LiveChat from '../components/viewer/LiveChat'
import MatchTimeline from '../components/viewer/MatchTimeline'
import LiveKitStage from '../components/viewer/LiveKitStage'
import FanShareBar from '../components/viewer/FanShareBar'
import FanCamMomentOverlay from '../components/viewer/FanCamMomentOverlay'
import LocalCameraPipLayer from '../components/viewer/LocalCameraPipLayer'
import MatchViewerLogin, { clearViewerJwt, readViewerJwt } from '../components/viewer/MatchViewerLogin'
import { useWebSocket } from '../hooks/useWebSocket'
import { useOverlaySync } from '../hooks/useOverlaySync'
import { useLiveKitRoom } from '../hooks/useLiveKitRoom'
import { useFanCamMoments } from '../hooks/useFanCamMoments'
import { deriveMediaMtxPair } from '../utils/streamUrls'

/*
 * Legacy viewer chat path (Redis `match:chat:*` + RTC DataChannel signalling on the scoring WebSocket)
 * has been disabled server-side. See commented blocks in `backend/src/ws/wsHandler.js` and
 * `frontend/src/hooks/useChatDataChannel.js` (still in repo, unused).
 */

/**
 * @param {{ viewerJwt: string, setViewerJwt: (t: string) => void }} props
 */
function ViewerInner({ viewerJwt, setViewerJwt }) {
  const { matchId } = useParams()
  const { matchState, matchLoading, matchError } = useMatch()
  const { timelineEvents } = useOverlay()
  const { currentLatency } = useStream()

  const [lkNonce, setLkNonce] = useState(0)

  const streamUrl = matchState?.match?.streamUrl || ''
  const streamKey = matchState?.match?.streamKey || ''

  const { hls: hlsUrl, whep: whepUrl } = useMemo(
    () => deriveMediaMtxPair(streamUrl, streamKey || null),
    [streamUrl, streamKey]
  )

  const overlayHandler = useOverlaySync()

  const handleWsMessage = useCallback(
    (msg) => {
      overlayHandler(msg)
    },
    [overlayHandler]
  )

  const { isConnected, reconnectAttempts } = useWebSocket({
    matchId: matchId || '',
    enabled: !!(matchId && viewerJwt),
    viewerToken: viewerJwt,
    onEvent: handleWsMessage,
  })

  const lk = useLiveKitRoom({
    matchId: matchId || '',
    viewerJwt,
    enabled: !!viewerJwt,
    reconnectNonce: lkNonce,
  })

  const { reactionPhase } = useFanCamMoments({ roomRef: lk.roomRef, connected: lk.connected })

  const wsErrorVisible = reconnectAttempts >= 3 && !!viewerJwt

  if (matchLoading && !matchState) {
    return <div className="flex min-h-screen items-center justify-center text-[#4a5568]">Loading…</div>
  }

  if (matchError && !matchState) {
    return <div className="flex min-h-screen items-center justify-center text-[#f44336]">{matchError}</div>
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e0e0e0]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a2030] bg-[#0d1117] px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{matchState?.match?.title || 'CricCast'}</h1>
          <p className="text-xs text-[#4a5568]">
            {viewerJwt ? (
              <>
                HLS / WebRTC playback · Overlay sync ~{currentLatency.toFixed(2)}s · scoring WS{' '}
                {isConnected ? 'live' : 'reconnecting…'}
                {lk.connected ? ' · LiveKit connected' : lk.connecting ? ' · LiveKit connecting…' : ''}
              </>
            ) : (
              <>Sign in with your invite to watch the stream, live overlays, and chat.</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewerJwt && (
            <button
              type="button"
              onClick={() => {
                clearViewerJwt(matchId || '')
                setViewerJwt('')
              }}
              className="text-xs text-[#4a5568] underline hover:text-[#e0e0e0]"
            >
              Sign out viewer
            </button>
          )}
          {matchState?.match?.status === 'LIVE' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff3c3c]/15 px-2 py-1 text-xs font-semibold text-[#ff3c3c]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff3c3c]" />
              LIVE
            </span>
          )}
        </div>
      </header>

      {wsErrorVisible && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
          Scoreboard WebSocket is reconnecting — overlays may lag until it recovers.
        </div>
      )}

      {!viewerJwt ? (
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-16">
          <MatchViewerLogin matchId={matchId || ''} onLoggedIn={(t) => setViewerJwt(t)} />
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 lg:flex-row">
          <div className="relative min-w-0 flex-[0.7]">
            <p className="mb-2 text-xs text-[#4a5568]">
              Viewer session active — LiveKit chat & room below. Use &quot;Sign out viewer&quot; to switch accounts.
            </p>
            <LiveKitStage roomRef={lk.roomRef} connected={lk.connected} attachLocalCamera={false} />
            <FanShareBar
              lkConnected={lk.connected}
              canPublish={lk.canPublish}
              onCameraStart={() => void lk.startCameraShare()}
              onCameraStop={() => void lk.stopCameraShare()}
            />
            <p className="mb-2 text-[10px] text-[#4a5568]">
              When you share camera, your preview appears centered on the WebRTC match tile below (same tile overlays use for six/four).
            </p>
            <DualStreamInfo hlsUrl={hlsUrl} whepUrl={whepUrl} savedStreamUrl={streamUrl} streamKey={streamKey} />
            <LiveStreamSection
              hlsUrl={hlsUrl}
              whepUrl={whepUrl}
              webrtcFanLayers={
                <>
                  <FanCamMomentOverlay phase={reactionPhase} />
                  <LocalCameraPipLayer roomRef={lk.roomRef} connected={lk.connected} />
                </>
              }
            />
            <LiveChat
              messages={lk.messages}
              viewerLoggedIn={!!viewerJwt}
              lkConnected={lk.connected}
              lkConnecting={lk.connecting}
              lkError={lk.error}
              canPublish={lk.canPublish}
              sendLiveKit={lk.sendChat}
              onReconnectLiveKit={() => setLkNonce((n) => n + 1)}
            />
          </div>
          <div className="min-w-0 flex-[0.3]">
            <MatchTimeline events={timelineEvents} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Viewer() {
  const { matchId } = useParams()
  if (!matchId) return null

  return <ViewerShell key={matchId} matchId={matchId} />
}

/**
 * @param {{ matchId: string }} props
 */
function ViewerShell({ matchId }) {
  const [viewerJwt, setViewerJwt] = useState(() => readViewerJwt(matchId))

  return (
    <StreamProvider>
      <OverlayProvider>
        <MatchProvider matchId={matchId} matchAudience="viewer" viewerAuthToken={viewerJwt}>
          <ViewerInner viewerJwt={viewerJwt} setViewerJwt={setViewerJwt} />
        </MatchProvider>
      </OverlayProvider>
    </StreamProvider>
  )
}
