import OverlayManager from '../overlays/OverlayManager'
import VideoPlayer from './VideoPlayer'

export default function PlayerShell({ streamUrl }) {
  return (
    <div className="relative w-full">
      <VideoPlayer streamUrl={streamUrl} />
      <OverlayManager />
    </div>
  )
}
