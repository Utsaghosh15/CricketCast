import { useEffect, useRef } from 'react'
import LiveKitStage from '../viewer/LiveKitStage'

/**
 * Scoring sidebar: LiveKit fan room tiles + relayed chat (broadcast lives in main column).
 * @param {{ lk: ReturnType<typeof import('../../hooks/useLiveKitAdminRoom').useLiveKitAdminRoom>, onReconnectLiveKit: () => void }} props
 */
export default function AdminLiveKitPanel({ lk, onReconnectLiveKit }) {
  const listRef = useRef(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lk.messages])

  const statusLine = (() => {
    if (lk.connecting) return 'Connecting to LiveKit…'
    if (lk.error) return `LiveKit: ${lk.error}`
    if (lk.connected) return 'Fan room + chat (read-only) ✓'
    return 'Not connected'
  })()

  return (
    <div className="rounded-xl border border-[#1a2030] bg-[#0d1117] p-3 text-[#e0e0e0]">
      <h3 className="mb-1 text-sm font-semibold text-[#00e5ff]/90">Fan room (LiveKit)</h3>
      <p className="mb-2 text-[10px] leading-relaxed text-[#4a5568]">
        Guest camera video is shown picture-in-picture on the live WebRTC feed when they publish. Turn on &quot;Six banner&quot; / &quot;Four banner&quot; in Auto overlays for highlight graphics.
      </p>

      <p className="mb-2 text-[10px] font-medium text-cyan-200/70">{statusLine}</p>
      <button
        type="button"
        onClick={onReconnectLiveKit}
        className="mb-2 text-[10px] text-[#00e5ff] underline"
      >
        Reconnect LiveKit
      </button>

      <p className="mb-1 text-[10px] font-semibold text-[#8899aa]">Fan cameras (LiveKit)</p>
      <LiveKitStage roomRef={lk.roomRef} connected={lk.connected} attachRemoteCameras={false} />

      <p className="mb-1 mt-3 text-[10px] font-semibold text-[#8899aa]">Viewer chat</p>
      <div
        ref={listRef}
        className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#1a2030] bg-[#0a0a0f] p-2 text-[10px]"
      >
        {lk.messages.length === 0 ? (
          <p className="text-[#4a5568]">No messages yet.</p>
        ) : (
          lk.messages.map((m) => (
            <div key={m.id} className="text-[#c5cdd8]">
              <span className="font-semibold text-[#00e5ff]/90">{m.displayName}</span>
              {m.emoji && <span className="ml-2 text-base">{m.emoji}</span>}
              {m.text && <span className="ml-2">{m.text}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
