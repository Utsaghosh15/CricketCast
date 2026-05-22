import { useMemo } from 'react'
import LiveStreamSection from '../viewer/LiveStreamSection'
import FanCamMomentOverlay from '../viewer/FanCamMomentOverlay'
import FanCamPipLayer from './FanCamPipLayer'
import { useFanCamMoments } from '../../hooks/useFanCamMoments'
import { deriveMediaMtxPair } from '../../utils/streamUrls'

/**
 * HLS / WHEP broadcast + fan-reaction overlay (same URLs as viewers).
 * @param {{ matchState: object | null, roomRef: React.MutableRefObject<import('livekit-client').Room | null>, connected: boolean }} props
 */
export default function AdminMatchLiveFeed({ matchState, roomRef, connected }) {
  const streamUrl = matchState?.match?.streamUrl || ''
  const streamKey = matchState?.match?.streamKey || ''
  const { hls: hlsUrl, whep: whepUrl } = useMemo(
    () => deriveMediaMtxPair(streamUrl, streamKey || null),
    [streamUrl, streamKey]
  )

  const { reactionPhase } = useFanCamMoments({ roomRef, connected })
  const hasStream = !!(hlsUrl || whepUrl)

  return (
    <div className="rounded-xl border border-[#1a2030] bg-[#0d1117] p-3 text-[#e0e0e0]">
      <h3 className="mb-1 text-sm font-semibold text-[#00e5ff]/90">Live match feed</h3>
      <p className="mb-2 text-[10px] leading-relaxed text-[#4a5568]">
        Same HLS / WebRTC tiles as viewers. Six/four banners sync to the WebRTC tile when the scoring WebSocket is connected. When a guest publishes camera, their video appears picture-in-picture on that tile (not duplicated in the Fan room tiles list).
      </p>

      {hasStream ? (
        <div className="mx-auto w-full max-w-5xl">
          <LiveStreamSection
            hlsUrl={hlsUrl}
            whepUrl={whepUrl}
            webrtcFanLayers={
              <>
                <FanCamMomentOverlay phase={reactionPhase} hideEnding />
                <FanCamPipLayer roomRef={roomRef} connected={connected} />
              </>
            }
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[#1a2030] bg-[#0a0a0f] p-2 text-[10px] text-[#4a5568]">
          No stream URLs on this match — set stream URL/key on the match record to load the broadcast here.
        </p>
      )}
    </div>
  )
}
