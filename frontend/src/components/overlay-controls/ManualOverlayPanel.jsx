import { useState } from 'react'

const BUTTONS = [
  { label: 'Batting scorecard', type: 'BATTING_SCORECARD' },
  { label: 'Bowling figures', type: 'BOWLING_FIGURES' },
  { label: 'Player card — Bat', type: 'PLAYER_CARD_BATSMAN' },
  { label: 'Player card — Bowl', type: 'PLAYER_CARD_BOWLER' },
  { label: 'Team lineup — T1', type: 'TEAM_LINEUP', options: { team: 'team1' } },
  { label: 'Team lineup — T2', type: 'TEAM_LINEUP', options: { team: 'team2' } },
  { label: 'Umpires', type: 'UMPIRES_CARD' },
  { label: 'Partnership', type: 'PARTNERSHIP' },
  { label: 'Required runs', type: 'REQUIRED_RUNS' },
  { label: 'Custom message', type: 'CUSTOM_MESSAGE', isCustom: true },
]

export default function ManualOverlayPanel({ postOverlay }) {
  const [loading, setLoading] = useState(null)
  const [ok, setOk] = useState(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customText, setCustomText] = useState('')
  const [customDur, setCustomDur] = useState(6)

  const flashOk = (type) => {
    setOk(type)
    window.setTimeout(() => setOk(null), 1200)
  }

  const send = async (type, extra = {}) => {
    setLoading(type)
    try {
      await postOverlay(type, extra)
      flashOk(type)
    } catch (e) {
      alert(e?.response?.data?.error || e.message)
    } finally {
      setLoading(null)
    }
  }

  const onCustom = async () => {
    if (!customText.trim()) return
    await send('CUSTOM_MESSAGE', { message: customText.trim(), duration: customDur })
    setCustomOpen(false)
    setCustomText('')
  }

  return (
    <div className="rounded-xl border border-[#1a2030] bg-[#0d1117] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#e0e0e0]">Show card</h3>
      <div className="grid grid-cols-2 gap-2">
        {BUTTONS.map((b) => (
          <button
            key={b.type}
            type="button"
            disabled={!!loading}
            onClick={() => (b.isCustom ? setCustomOpen(true) : send(b.type, b.options || {}))}
            className="relative min-h-[44px] rounded-lg border border-[#1a2030] px-2 py-2 text-center text-xs font-medium text-[#e0e0e0] disabled:opacity-40"
          >
            {loading === b.type ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#00e5ff] border-t-transparent" />
            ) : ok === b.type ? (
              <span className="text-[#00e676]">✓</span>
            ) : (
              b.label
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!!loading}
        onClick={() => send('HIDE_ALL')}
        className="mt-3 w-full rounded-lg bg-[#f44336]/20 py-3 text-sm font-semibold text-[#f44336] disabled:opacity-40"
      >
        {loading === 'HIDE_ALL' ? '…' : 'Hide all overlays'}
      </button>

      {customOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a2030] bg-[#0d1117] p-4">
            <h4 className="mb-2 font-semibold">Custom message</h4>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={3}
              className="mb-2 w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] p-2 text-sm"
              placeholder="On-screen text"
            />
            <label className="mb-2 flex items-center gap-2 text-xs text-[#4a5568]">
              Duration (seconds)
              <input
                type="number"
                min={2}
                max={60}
                value={customDur}
                onChange={(e) => setCustomDur(Number(e.target.value) || 6)}
                className="w-16 rounded border border-[#1a2030] bg-[#0a0a0f] px-1"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCustomOpen(false)} className="flex-1 rounded border border-[#1a2030] py-2 text-sm">
                Cancel
              </button>
              <button type="button" onClick={onCustom} className="flex-1 rounded bg-[#00e5ff] py-2 text-sm font-semibold text-[#0a0a0f]">
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
