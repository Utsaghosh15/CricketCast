import { useEffect, useRef } from 'react'
import { RoomEvent, Track } from 'livekit-client'

/**
 * Attach local + remote **camera** video only (no screen-share tiles).
 * @param {{ roomRef: React.MutableRefObject<import('livekit-client').Room | null>, connected: boolean, attachRemoteCameras?: boolean, attachLocalCamera?: boolean, disconnectedHint?: string }} props
 */
export default function LiveKitStage({
  roomRef,
  connected,
  attachRemoteCameras = true,
  attachLocalCamera = true,
  disconnectedHint,
}) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    const room = roomRef.current
    if (!host || !room || !connected) return undefined
    if (!attachRemoteCameras && !attachLocalCamera) return undefined

    /** @type {Array<{ track: import('livekit-client').VideoTrack, wrap: HTMLDivElement, sid?: string }>} */
    const attached = []

    const detachEntry = (entry) => {
      try {
        const v = entry.wrap.querySelector('video')
        if (v) entry.track.detach(v)
      } catch {
        /* ignore */
      }
      try {
        entry.wrap.remove()
      } catch {
        /* ignore */
      }
    }

    const attachVideo = (track, participant, labelSuffix = '', sid) => {
      if (!track || track.kind !== Track.Kind.Video) return
      try {
        const el = track.attach()
        el.className = 'w-full max-h-[360px] rounded-lg border border-[#1a2030] bg-black object-contain'
        el.playsInline = true
        const label = document.createElement('div')
        label.className = 'mb-1 text-[10px] text-[#8899aa]'
        label.textContent = `${participant?.identity || 'peer'}${labelSuffix} · camera`
        const wrap = document.createElement('div')
        wrap.className = 'mb-3'
        wrap.appendChild(label)
        wrap.appendChild(el)
        host.appendChild(wrap)
        attached.push({ track, wrap, sid })
      } catch (e) {
        console.warn('[LiveKitStage] attach failed', e)
      }
    }

    const onSubscribed = (track, publication, participant) => {
      if (!attachRemoteCameras) return
      if (publication?.source !== Track.Source.Camera) return
      attachVideo(track, participant)
    }

    const onLocalPublished = (pub) => {
      if (!attachLocalCamera) return
      const t = pub.track
      if (t && pub.kind === Track.Kind.Video && pub.source === Track.Source.Camera) {
        attachVideo(t, room.localParticipant, ' (you)', pub.trackSid)
      }
    }

    const onLocalUnpublished = (pub) => {
      if (!attachLocalCamera) return
      if (pub.source !== Track.Source.Camera) return
      const sid = pub.trackSid
      for (let i = attached.length - 1; i >= 0; i--) {
        if (attached[i].sid && attached[i].sid === sid) {
          detachEntry(attached[i])
          attached.splice(i, 1)
        }
      }
    }

    if (attachRemoteCameras) {
      room.on(RoomEvent.TrackSubscribed, onSubscribed)
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.source === Track.Source.Camera && pub.track && pub.isSubscribed) attachVideo(pub.track, p)
        })
      })
    }

    if (attachLocalCamera) {
      room.on(RoomEvent.LocalTrackPublished, onLocalPublished)
      room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
      room.localParticipant.trackPublications.forEach((pub) => {
        if (pub.source === Track.Source.Camera && pub.track && pub.kind === Track.Kind.Video) {
          attachVideo(pub.track, room.localParticipant, ' (you)', pub.trackSid)
        }
      })
    }

    return () => {
      if (attachRemoteCameras) {
        room.off(RoomEvent.TrackSubscribed, onSubscribed)
      }
      if (attachLocalCamera) {
        room.off(RoomEvent.LocalTrackPublished, onLocalPublished)
        room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
      }
      for (const entry of attached) detachEntry(entry)
      attached.length = 0
    }
  }, [roomRef, connected, attachRemoteCameras, attachLocalCamera])

  if (!connected) {
    return (
      <div className="rounded-xl border border-dashed border-[#1a2030] bg-[#0d1117] p-4 text-center text-sm text-[#4a5568]">
        {disconnectedHint || 'Sign in with your invite to load the LiveKit stream.'}
      </div>
    )
  }

  if (!attachRemoteCameras) {
    return (
      <p className="rounded-lg border border-dashed border-[#1a2030] bg-[#0a0a0f] p-2 text-[10px] leading-relaxed text-[#4a5568]">
        Remote fan cameras appear as picture-in-picture on the live match feed when guests publish video.
      </p>
    )
  }

  return <div ref={hostRef} className="space-y-2" />
}
