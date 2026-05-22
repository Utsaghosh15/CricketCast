import { useEffect, useRef, useState } from 'react'
import { RoomEvent, Track } from 'livekit-client'

/**
 * @param {import('livekit-client').Room | null} room
 */
function pickLocalCameraForPip(room) {
  if (!room) return null
  const lp = room.localParticipant
  for (const pub of lp.trackPublications.values()) {
    if (pub.source !== Track.Source.Camera || !pub.track || pub.kind !== Track.Kind.Video) continue
    if (typeof pub.isMuted === 'boolean' && pub.isMuted) continue
    const vt = pub.track
    if (typeof vt.isMuted === 'boolean' && vt.isMuted) continue
    const mst = vt.mediaStreamTrack
    if (mst?.readyState === 'ended') continue
    return { track: vt, sid: pub.trackSid }
  }
  return null
}

function pipKeyLocal(room) {
  const row = pickLocalCameraForPip(room)
  if (!row) return null
  const id = row.track?.mediaStreamTrack?.id || row.sid || 'local'
  return `local:${id}`
}

/**
 * Your camera on the WebRTC match tile (one element per track — LiveKitStage skips local when this is used).
 * @param {{ roomRef: React.MutableRefObject<import('livekit-client').Room | null>, connected: boolean }} props
 */
export default function LocalCameraPipLayer({ roomRef, connected }) {
  const wrapRef = useRef(null)
  const entryRef = useRef(null)
  const [pipKey, setPipKey] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    const detach = () => {
      const e = entryRef.current
      entryRef.current = null
      if (e) {
        try {
          if (e.video) e.track.detach(e.video)
          else e.track.detach()
        } catch {
          /* ignore */
        }
        try {
          e.el?.remove()
        } catch {
          /* ignore */
        }
      }
      const wrap = wrapRef.current
      if (wrap) {
        while (wrap.firstChild) {
          try {
            wrap.removeChild(wrap.firstChild)
          } catch {
            break
          }
        }
      }
    }

    if (!connected) {
      detach()
      setPipKey(null)
      return undefined
    }
    const room = roomRef.current
    if (!room) {
      detach()
      setPipKey(null)
      return undefined
    }

    const sync = () => setPipKey(pipKeyLocal(room))

    room.on(RoomEvent.LocalTrackPublished, sync)
    room.on(RoomEvent.LocalTrackUnpublished, sync)
    room.on(RoomEvent.TrackMuted, sync)
    room.on(RoomEvent.TrackUnmuted, sync)

    sync()

    return () => {
      room.off(RoomEvent.LocalTrackPublished, sync)
      room.off(RoomEvent.LocalTrackUnpublished, sync)
      room.off(RoomEvent.TrackMuted, sync)
      room.off(RoomEvent.TrackUnmuted, sync)
      detach()
      setPipKey(null)
    }
  }, [roomRef, connected])

  useEffect(() => {
    const detach = () => {
      const e = entryRef.current
      entryRef.current = null
      if (e) {
        try {
          if (e.video) e.track.detach(e.video)
          else e.track.detach()
        } catch {
          /* ignore */
        }
        try {
          e.el?.remove()
        } catch {
          /* ignore */
        }
      }
      const wrap = wrapRef.current
      if (wrap) {
        while (wrap.firstChild) {
          try {
            wrap.removeChild(wrap.firstChild)
          } catch {
            break
          }
        }
      }
    }

    const wrap = wrapRef.current
    const room = roomRef.current
    if (!pipKey || !connected || !wrap || !room) {
      detach()
      return undefined
    }

    const row = pickLocalCameraForPip(room)
    if (!row || pipKeyLocal(room) !== pipKey) {
      detach()
      setPipKey(pipKeyLocal(room))
      return undefined
    }

    detach()
    try {
      const el = row.track.attach()
      el.className = 'h-full w-full object-contain'
      el.playsInline = true
      const label = document.createElement('div')
      label.className =
        'absolute left-0 right-0 top-0 truncate bg-black/70 px-2 py-1 text-[10px] text-[#8899aa]'
      label.textContent = `${room.localParticipant?.identity || 'You'} · your camera`
      const box = document.createElement('div')
      box.className = 'relative h-full w-full overflow-hidden rounded-lg bg-black'
      box.appendChild(label)
      box.appendChild(el)
      wrap.appendChild(box)
      entryRef.current = { track: row.track, el: box, video: el }

      const onVideoEnded = () => setPipKey(null)
      el.addEventListener('ended', onVideoEnded)
      const mst = row.track.mediaStreamTrack
      if (mst) mst.addEventListener('ended', onVideoEnded)

      return () => {
        el.removeEventListener('ended', onVideoEnded)
        if (mst) mst.removeEventListener('ended', onVideoEnded)
        detach()
      }
    } catch {
      detach()
      setPipKey(null)
      return undefined
    }
  }, [pipKey, connected, roomRef])

  if (!connected || !pipKey) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-32 flex items-center justify-center p-3">
      <div
        ref={wrapRef}
        className="aspect-video w-[min(78%,22rem)] max-w-full overflow-hidden rounded-lg border-2 border-[#00e5ff]/45 bg-black shadow-2xl shadow-black/60"
      />
    </div>
  )
}
