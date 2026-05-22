import { useEffect, useRef, useState } from 'react'
import { RoomEvent, Track } from 'livekit-client'

/**
 * @param {import('livekit-client').Room | null} room
 * @returns {{ track: import('livekit-client').VideoTrack, participant: import('livekit-client').RemoteParticipant } | null}
 */
function pickRemoteCameraForPip(room) {
  if (!room) return null
  for (const p of room.remoteParticipants.values()) {
    for (const pub of p.trackPublications.values()) {
      if (pub.source !== Track.Source.Camera) continue
      if (!pub.isSubscribed || !pub.track) continue
      if (typeof pub.isMuted === 'boolean' && pub.isMuted) continue
      const vt = pub.track
      if (typeof vt.isMuted === 'boolean' && vt.isMuted) continue
      const mst = vt.mediaStreamTrack
      if (mst?.readyState === 'ended') continue
      return { track: vt, participant: p }
    }
  }
  return null
}

function pipKeyFromRow(row) {
  if (!row) return null
  const id = row.track?.mediaStreamTrack?.id || row.track?.sid || 'track'
  return `${row.participant.identity}:${id}`
}

/**
 * Picture-in-picture for the first remote fan camera on the WebRTC match tile.
 * Hides automatically when the guest unpublishes, unmutes to nothing useful, or the track ends — no stale black box.
 * @param {{ roomRef: React.MutableRefObject<import('livekit-client').Room | null>, connected: boolean }} props
 */
export default function FanCamPipLayer({ roomRef, connected }) {
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

    const sync = () => {
      const row = pickRemoteCameraForPip(room)
      setPipKey(pipKeyFromRow(row))
    }

    const onRoomChange = () => sync()

    room.on(RoomEvent.TrackSubscribed, onRoomChange)
    room.on(RoomEvent.TrackUnsubscribed, onRoomChange)
    room.on(RoomEvent.TrackPublished, onRoomChange)
    room.on(RoomEvent.TrackUnpublished, onRoomChange)
    room.on(RoomEvent.TrackMuted, onRoomChange)
    room.on(RoomEvent.TrackUnmuted, onRoomChange)
    room.on(RoomEvent.ParticipantConnected, onRoomChange)
    room.on(RoomEvent.ParticipantDisconnected, onRoomChange)

    sync()

    return () => {
      room.off(RoomEvent.TrackSubscribed, onRoomChange)
      room.off(RoomEvent.TrackUnsubscribed, onRoomChange)
      room.off(RoomEvent.TrackPublished, onRoomChange)
      room.off(RoomEvent.TrackUnpublished, onRoomChange)
      room.off(RoomEvent.TrackMuted, onRoomChange)
      room.off(RoomEvent.TrackUnmuted, onRoomChange)
      room.off(RoomEvent.ParticipantConnected, onRoomChange)
      room.off(RoomEvent.ParticipantDisconnected, onRoomChange)
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

    const row = pickRemoteCameraForPip(room)
    if (!row || pipKeyFromRow(row) !== pipKey) {
      detach()
      setPipKey(pipKeyFromRow(row))
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
      label.textContent = `${row.participant?.identity || 'Fan'} · camera`
      const box = document.createElement('div')
      box.className = 'relative h-full w-full overflow-hidden rounded-lg bg-black'
      box.appendChild(label)
      box.appendChild(el)
      wrap.appendChild(box)
      entryRef.current = { track: row.track, el: box, video: el }

      const onVideoEnded = () => {
        setPipKey(null)
      }
      el.addEventListener('ended', onVideoEnded)
      const mst = row.track.mediaStreamTrack
      if (mst) {
        mst.addEventListener('ended', onVideoEnded)
      }

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
