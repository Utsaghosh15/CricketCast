/**
 * Camera-only controls when the host has granted publish (no screen share).
 * @param {{
 *   lkConnected: boolean
 *   canPublish: boolean
 *   onCameraStart: () => void
 *   onCameraStop: () => void
 * }} props
 */
export default function FanShareBar({ lkConnected, canPublish, onCameraStart, onCameraStop }) {
  if (!lkConnected || !canPublish) return null

  return (
    <div className="mb-3 rounded-xl border border-[#00e5ff]/25 bg-[#0d1117] p-3">
      <p className="mb-2 text-xs font-semibold text-[#e0e0e0]">Share your camera with the fan room</p>
      <p className="mb-3 text-[10px] text-[#4a5568]">
        Appears in the tiles above for other viewers on this page. Use a click on Share camera so the browser can use
        your mic/camera (autoplay rules).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCameraStart}
          className="rounded-lg bg-[#00e5ff] px-3 py-2 text-xs font-semibold text-[#0a0a0f] hover:opacity-90"
        >
          Share camera
        </button>
        <button
          type="button"
          onClick={onCameraStop}
          className="rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-xs text-[#e0e0e0] hover:border-[#f44336]/50"
        >
          Stop camera
        </button>
      </div>
    </div>
  )
}
