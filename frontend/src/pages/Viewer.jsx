import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { MatchProvider, useMatch } from '../context/MatchContext'
import { OverlayProvider, useOverlay } from '../context/OverlayContext'
import { StreamProvider, useStream } from '../context/StreamContext'
import DualStreamInfo from '../components/viewer/DualStreamInfo'
import LiveStreamSection from '../components/viewer/LiveStreamSection'
import LiveChat from '../components/viewer/LiveChat'
import MatchTimeline from '../components/viewer/MatchTimeline'
import { useWebSocket } from '../hooks/useWebSocket'
import { useOverlaySync } from '../hooks/useOverlaySync'
import { useMatchChatFeed } from '../hooks/useMatchChatFeed'
import { useChatDataChannel } from '../hooks/useChatDataChannel'
import { deriveMediaMtxPair } from '../utils/streamUrls'

function ViewerInner() {
  const { matchId } = useParams()
  const { matchState, matchLoading, matchError } = useMatch()
  const { timelineEvents } = useOverlay()
  const { currentLatency } = useStream()

  const streamUrl = matchState?.match?.streamUrl || ''
  const streamKey = matchState?.match?.streamKey || ''

  const { hls: hlsUrl, whep: whepUrl } = useMemo(
    () => deriveMediaMtxPair(streamUrl, streamKey || null),
    [streamUrl, streamKey]
  )

  const { messages, ingest } = useMatchChatFeed()

  const overlayHandler = useOverlaySync()

  const dcSignalRef = useRef(null)

  const handleWsMessage = useCallback(
    (msg) => {
      const t = msg?.type
      if (t === 'DC_CHAT_ANSWER' || t === 'DC_CHAT_CANDIDATE' || t === 'DC_CHAT_ERROR') {
        void dcSignalRef.current?.(msg)
        return
      }
      const ch = msg?.channel
      if (typeof ch === 'string' && ch.startsWith('match:chat')) {
        const p = msg.payload
        if (p?.type === 'CHAT_MESSAGE') ingest(p)
        return
      }
      overlayHandler(msg)
    },
    [ingest, overlayHandler]
  )

  const { isConnected, reconnectAttempts, send } = useWebSocket({
    matchId,
    enabled: !!matchId,
    onEvent: handleWsMessage,
  })

  const { dcState, dcError, handleSignal, sendChatPayload } = useChatDataChannel({
    matchId,
    wsConnected: isConnected,
    send,
    onInbound: ingest,
  })

  useEffect(() => {
    dcSignalRef.current = handleSignal
  }, [handleSignal])

  const wsErrorVisible = reconnectAttempts >= 3

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
            Dual HLS + WebRTC · Overlay sync ~{currentLatency.toFixed(2)}s (RTC-derived estimate) · WS{' '}
            {isConnected ? 'live' : 'reconnecting…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          Stream sync is reconnecting — overlays may lag until the socket recovers (chat uses WebRTC signalling on the same connection).
        </div>
      )}

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 lg:flex-row">
        <div className="relative min-w-0 flex-[0.7]">
          <DualStreamInfo hlsUrl={hlsUrl} whepUrl={whepUrl} savedStreamUrl={streamUrl} streamKey={streamKey} />
          <LiveStreamSection hlsUrl={hlsUrl} whepUrl={whepUrl} />
          <LiveChat
            matchId={matchId}
            messages={messages}
            wsConnected={isConnected}
            dcState={dcState}
            dcError={dcError}
            sendDc={sendChatPayload}
            sendWs={send}
          />
        </div>
        <div className="min-w-0 flex-[0.3]">
          <MatchTimeline events={timelineEvents} />
        </div>
      </div>
    </div>
  )
}

export default function Viewer() {
  const { matchId } = useParams()
  if (!matchId) return null

  return (
    <StreamProvider>
      <OverlayProvider>
        <MatchProvider matchId={matchId}>
          <ViewerInner />
        </MatchProvider>
      </OverlayProvider>
    </StreamProvider>
  )
}
