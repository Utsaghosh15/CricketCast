import { useEffect, useRef, useState } from 'react'
import { RoomEvent, Track } from 'livekit-client'

function remoteCameraCount(room) {
  let n = 0
  for (const p of room.remoteParticipants.values()) {
    p.trackPublications.forEach((pub) => {
      if (pub.source === Track.Source.Camera && pub.isSubscribed && pub.track) n += 1
    })
  }
  return n
}

/**
 * One continuous viewer-reaction arc on the main stream. Debounces brief track drops so LiveKit
 * reconnect blips do not fire a false "reaction ended".
 */
export function useFanCamMoments({ roomRef, connected }) {
  const [reactionPhase, setReactionPhase] = useState('none')
  const countRef = useRef(0)
  const startingTimerRef = useRef(null)
  const endingTimerRef = useRef(null)
  const endDebounceRef = useRef(null)

  useEffect(() => {
    if (!connected) {
      countRef.current = 0
      if (startingTimerRef.current) clearTimeout(startingTimerRef.current)
      if (endingTimerRef.current) clearTimeout(endingTimerRef.current)
      if (endDebounceRef.current) clearTimeout(endDebounceRef.current)
      startingTimerRef.current = null
      endingTimerRef.current = null
      endDebounceRef.current = null
      setReactionPhase('none')
      return undefined
    }

    const room = roomRef.current
    if (!room) return undefined

    const clearStarting = () => {
      if (startingTimerRef.current) clearTimeout(startingTimerRef.current)
      startingTimerRef.current = null
    }
    const clearEnding = () => {
      if (endingTimerRef.current) clearTimeout(endingTimerRef.current)
      endingTimerRef.current = null
    }
    const clearEndDebounce = () => {
      if (endDebounceRef.current) clearTimeout(endDebounceRef.current)
      endDebounceRef.current = null
    }

    const scheduleEnding = () => {
      clearEndDebounce()
      endDebounceRef.current = window.setTimeout(() => {
        endDebounceRef.current = null
        if (countRef.current !== 0) return
        clearStarting()
        clearEnding()
        setReactionPhase('ending')
        endingTimerRef.current = window.setTimeout(() => {
          endingTimerRef.current = null
          setReactionPhase('none')
        }, 3800)
      }, 750)
    }

    const applyCount = (next) => {
      const prev = countRef.current
      countRef.current = next

      if (prev === 0 && next > 0) {
        clearEnding()
        clearStarting()
        clearEndDebounce()
        setReactionPhase('starting')
        startingTimerRef.current = window.setTimeout(() => {
          startingTimerRef.current = null
          if (countRef.current > 0) {
            setReactionPhase('live')
          } else {
            setReactionPhase('none')
          }
        }, 2200)
        return
      }

      if (prev > 0 && next === 0) {
        clearStarting()
        clearEnding()
        scheduleEnding()
      }
    }

    const recount = () => {
      applyCount(remoteCameraCount(room))
    }

    const onSubscribed = (track, publication, participant) => {
      if (participant === room.localParticipant) return
      if (track.kind !== Track.Kind.Video) return
      const src = publication?.source ?? track.source
      if (src !== Track.Source.Camera) return
      if (endDebounceRef.current) {
        clearTimeout(endDebounceRef.current)
        endDebounceRef.current = null
      }
      recount()
    }

    const onUnsubscribed = (_track, _publication, participant) => {
      if (participant === room.localParticipant) return
      recount()
    }

    const onParticipantConnected = () => recount()
    const onParticipantDisconnected = () => recount()

    room.on(RoomEvent.TrackSubscribed, onSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected)
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)

    applyCount(remoteCameraCount(room))

    return () => {
      room.off(RoomEvent.TrackSubscribed, onSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected)
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      clearStarting()
      clearEnding()
      clearEndDebounce()
    }
  }, [roomRef, connected])

  return { reactionPhase }
}
