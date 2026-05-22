import { useEffect } from 'react'
import { useMatch } from '../../context/MatchContext'
import { useOverlay } from '../../context/OverlayContext'
import ScoreBug from './ScoreBug'
import SixBanner from './SixBanner'
import FourBanner from './FourBanner'
import WicketBanner from './WicketBanner'
import OverSummary from './OverSummary'
import ScorecardCard from './ScorecardCard'
import BowlingCard from './BowlingCard'
import PlayerCard from './PlayerCard'
import TeamLineupCard from './TeamLineupCard'
import UmpiresCard from './UmpiresCard'
import PartnershipCard from './PartnershipCard'
import RequiredRunsCard from './RequiredRunsCard'
import CustomMessageCard from './CustomMessageCard'

export default function OverlayManager() {
  const { matchState } = useMatch()
  const { activeBanner, setActiveBanner, activeCard, setActiveCard, scoreFlashKey } = useOverlay()

  useEffect(() => {
    if (!activeBanner?.expiresAt) return undefined
    const ms = Math.max(0, activeBanner.expiresAt - Date.now())
    const t = window.setTimeout(() => setActiveBanner(null), ms)
    return () => clearTimeout(t)
  }, [activeBanner, setActiveBanner])

  useEffect(() => {
    if (!activeCard?.expiresAt) return undefined
    const ms = Math.max(0, activeCard.expiresAt - Date.now())
    const t = window.setTimeout(() => setActiveCard(null), ms)
    return () => clearTimeout(t)
  }, [activeCard, setActiveCard])

  const renderBanner = () => {
    if (!activeBanner) return null
    const { type, data } = activeBanner
    const wrap = (child) => (
      <div className="pointer-events-none absolute inset-x-0 top-8 z-20 flex justify-center px-4">{child}</div>
    )
    if (type === 'SIX') return wrap(<SixBanner data={data} />)
    if (type === 'FOUR') return wrap(<FourBanner data={data} />)
    if (type === 'WICKET') return wrap(<WicketBanner data={data} />)
    if (type === 'OVER_END' || type === 'OVER_SUMMARY') {
      return (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center">
          <OverSummary data={data} />
        </div>
      )
    }
    return null
  }

  const renderCard = () => {
    if (!activeCard) return null
    const { type, data } = activeCard
    const wrap = (child, pos = 'center') => (
      <div
        className={`pointer-events-none absolute z-20 flex px-4 ${
          pos === 'right' ? 'right-0 top-1/4 w-full max-w-sm justify-end' : 'inset-0 items-center justify-center'
        }`}
      >
        {child}
      </div>
    )
    if (type === 'BATTING_SCORECARD' || type === 'SCORECARD') return wrap(<ScorecardCard state={matchState} />)
    if (type === 'BOWLING_FIGURES' || type === 'BOWLING_CARD') return wrap(<BowlingCard state={matchState} />)
    if (
      type === 'PLAYER_CARD' ||
      type === 'PLAYER_CARD_BAT' ||
      type === 'PLAYER_CARD_BOWL' ||
      type === 'PLAYER_CARD_BATSMAN' ||
      type === 'PLAYER_CARD_BOWLER'
    ) {
      return wrap(<PlayerCard state={matchState} variant={type} />, 'right')
    }
    if (type === 'TEAM_LINEUP' || type === 'TEAM_LINEUP_T1' || type === 'TEAM_LINEUP_T2') {
      return wrap(<TeamLineupCard state={matchState} variant={type} data={data} />)
    }
    if (type === 'UMPIRES' || type === 'UMPIRES_CARD') return wrap(<UmpiresCard state={matchState} />, 'right')
    if (type === 'PARTNERSHIP') return wrap(<PartnershipCard state={matchState} />, 'right')
    if (type === 'REQUIRED_RUNS') return wrap(<RequiredRunsCard state={matchState} />)
    if (type === 'CUSTOM_MESSAGE') return wrap(<CustomMessageCard data={data} />)
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[40] overflow-hidden">
      {renderBanner()}
      {renderCard()}
      <ScoreBug data={matchState} flashKey={scoreFlashKey} />
    </div>
  )
}
