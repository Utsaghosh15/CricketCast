import { useState } from 'react'

export default function ExtrasPanel({ disabled, onExtra, onWicketClick, error }) {
  const [wideMode, setWideMode] = useState(false)
  const [nbMode, setNbMode] = useState(false)
  const [byeMode, setByeMode] = useState(false)
  const [lbMode, setLbMode] = useState(false)

  const closeAll = () => {
    setWideMode(false)
    setNbMode(false)
    setByeMode(false)
    setLbMode(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#1a2030] bg-[#0d1117] p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[#4a5568]">Extras & wicket</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            closeAll()
            setWideMode(true)
          }}
          className="min-h-[48px] rounded-lg bg-[#ffb300]/10 text-sm font-medium text-[#ffb300] disabled:opacity-40"
        >
          Wide
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            closeAll()
            setNbMode(true)
          }}
          className="min-h-[48px] rounded-lg bg-orange-500/10 text-sm font-medium text-orange-300 disabled:opacity-40"
        >
          No ball
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            closeAll()
            setByeMode(true)
          }}
          className="min-h-[48px] rounded-lg border border-[#1a2030] text-sm disabled:opacity-40"
        >
          Bye
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            closeAll()
            setLbMode(true)
          }}
          className="min-h-[48px] rounded-lg border border-[#1a2030] text-sm disabled:opacity-40"
        >
          Leg bye
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onWicketClick}
          className="col-span-2 min-h-[48px] rounded-lg bg-[#f44336]/15 font-semibold text-[#f44336] disabled:opacity-40"
        >
          Wicket
        </button>
      </div>

      {wideMode && (
        <div className="rounded-lg border border-[#ffb300]/30 p-2">
          <p className="mb-2 text-xs text-[#4a5568]">Wide + extra runs (penalty included)</p>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((er) => (
              <button
                key={er}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onExtra({ type: 'WIDE', extraRuns: er })
                  setWideMode(false)
                }}
                className={`min-h-[44px] min-w-[44px] rounded-lg px-2 text-sm font-medium ${
                  er === 0 ? 'bg-[#ffb300] text-[#0a0a0f]' : 'border border-[#1a2030]'
                }`}
              >
                +{er}
              </button>
            ))}
          </div>
        </div>
      )}

      {nbMode && (
        <div className="rounded-lg border border-orange-500/30 p-2 space-y-2">
          <p className="text-xs text-[#4a5568]">Runs off bat (no-ball free hit next)</p>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 6].map((r) => (
              <button
                key={r}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onExtra({ type: 'NO_BALL', runsOffBat: r })
                  setNbMode(false)
                }}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-[#1a2030] text-sm font-medium"
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onWicketClick()
              setNbMode(false)
            }}
            className="w-full rounded border border-[#f44336]/50 py-2 text-xs text-[#f44336]"
          >
            + Run out (use wicket flow)
          </button>
        </div>
      )}

      {(byeMode || lbMode) && (
        <div className="rounded-lg border border-[#1a2030] p-2">
          <p className="mb-2 text-xs text-[#4a5568]">Runs</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((r) => (
              <button
                key={r}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onExtra({ type: byeMode ? 'BYE' : 'LEG_BYE', runsOffBat: r })
                  setByeMode(false)
                  setLbMode(false)
                }}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-[#1a2030] text-sm font-medium"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-[#f44336]">{error}</p>}
    </div>
  )
}
