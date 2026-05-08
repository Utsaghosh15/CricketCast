import { useMemo, useState } from 'react'

const TYPES = [
  'BOWLED',
  'CAUGHT',
  'LBW',
  'RUN_OUT',
  'STUMPED',
  'HIT_WICKET',
  'OBSTRUCTING_FIELD',
  'TIMED_OUT',
]

export default function WicketModal({ open, onClose, state, onConfirm, loading }) {
  const [step, setStep] = useState(1)
  const [dismissalType, setDismissalType] = useState('BOWLED')
  const [fielderId, setFielderId] = useState('')
  const [dismissedChoice, setDismissedChoice] = useState('striker')
  const [runsOffBat, setRunsOffBat] = useState(0)
  const [newBatsmanId, setNewBatsmanId] = useState('')

  const striker = state?.batting?.striker
  const non = state?.batting?.nonStriker

  const { battingPlayers, bowlingPlayers } = useMemo(() => {
    const t1 = state?.teams?.team1?.players || []
    const t2 = state?.teams?.team2?.players || []
    const sid = striker?.id
    const inT1 = t1.some((p) => p.id === sid)
    const inT2 = t2.some((p) => p.id === sid)
    if (inT1) return { battingPlayers: t1, bowlingPlayers: t2 }
    if (inT2) return { battingPlayers: t2, bowlingPlayers: t1 }
    return { battingPlayers: t1, bowlingPlayers: t2 }
  }, [state?.teams, striker?.id])

  const dismissedPlayerId = useMemo(() => {
    if (dismissalType === 'RUN_OUT') {
      return dismissedChoice === 'striker' ? striker?.id : non?.id
    }
    return striker?.id
  }, [dismissalType, dismissedChoice, non?.id, striker?.id])

  const partnerId = useMemo(() => {
    if (!dismissedPlayerId) return null
    return dismissedPlayerId === striker?.id ? non?.id : striker?.id
  }, [dismissedPlayerId, non?.id, striker?.id])

  const newBatOptions = useMemo(() => {
    return battingPlayers.filter((p) => p.id !== dismissedPlayerId && p.id !== partnerId)
  }, [battingPlayers, dismissedPlayerId, partnerId])

  const reset = () => {
    setStep(1)
    setDismissalType('BOWLED')
    setFielderId('')
    setDismissedChoice('striker')
    setRunsOffBat(0)
    setNewBatsmanId('')
  }

  if (!open) return null

  const needsFielder = dismissalType === 'CAUGHT' || dismissalType === 'RUN_OUT'
  const wkDefault = bowlingPlayers.find((p) => p.role === 'WICKET_KEEPER' || p.is_wicketkeeper)?.id || ''

  const buildPayload = () => ({
    type: 'WICKET',
    dismissalType,
    dismissedPlayerId,
    fielderId:
      dismissalType === 'STUMPED'
        ? fielderId || wkDefault || null
        : needsFielder
          ? fielderId || null
          : null,
    runsOffBat,
    newBatsmanId,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#1a2030] bg-[#0d1117] p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Wicket</h2>
          <button
            type="button"
            onClick={() => {
              reset()
              onClose()
            }}
            className="text-[#4a5568]"
          >
            ✕
          </button>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setDismissalType(t)
                  setStep(2)
                }}
                className="rounded-lg border border-[#1a2030] py-2 text-xs font-medium"
              >
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {dismissalType === 'CAUGHT' && (
              <div>
                <label className="mb-1 block text-xs text-[#4a5568]">Fielder</label>
                <select
                  value={fielderId}
                  onChange={(e) => setFielderId(e.target.value)}
                  className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-2 py-2 text-sm"
                >
                  <option value="">Select fielder</option>
                  {bowlingPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {dismissalType === 'STUMPED' && (
              <div>
                <label className="mb-1 block text-xs text-[#4a5568]">Wicket-keeper</label>
                <select
                  value={fielderId || wkDefault}
                  onChange={(e) => setFielderId(e.target.value)}
                  className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-2 py-2 text-sm"
                >
                  {bowlingPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {dismissalType === 'RUN_OUT' && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-[#4a5568]">Fielder</label>
                  <select
                    value={fielderId}
                    onChange={(e) => setFielderId(e.target.value)}
                    className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-2 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    {bowlingPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-[#4a5568]">Batsman out</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDismissedChoice('striker')}
                      className={`flex-1 rounded-lg py-2 text-sm ${dismissedChoice === 'striker' ? 'bg-[#00e5ff] text-[#0a0a0f]' : 'border border-[#1a2030]'}`}
                    >
                      {striker?.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedChoice('non')}
                      className={`flex-1 rounded-lg py-2 text-sm ${dismissedChoice === 'non' ? 'bg-[#00e5ff] text-[#0a0a0f]' : 'border border-[#1a2030]'}`}
                    >
                      {non?.name}
                    </button>
                  </div>
                </div>
              </>
            )}
            {(dismissalType === 'CAUGHT' || dismissalType === 'RUN_OUT' || dismissalType === 'STUMPED') && (
              <button
                type="button"
                disabled={dismissalType === 'CAUGHT' && !fielderId}
                onClick={() => setStep(3)}
                className="w-full rounded-lg bg-[#00e5ff] py-2 text-sm font-semibold text-[#0a0a0f] disabled:opacity-40"
              >
                Next
              </button>
            )}
            {!(dismissalType === 'CAUGHT' || dismissalType === 'RUN_OUT' || dismissalType === 'STUMPED') && (
              <button type="button" onClick={() => setStep(3)} className="w-full rounded-lg bg-[#00e5ff] py-2 text-sm font-semibold text-[#0a0a0f]">
                Next
              </button>
            )}
            <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-[#4a5568]">
              Back
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-[#4a5568]">Runs scored on the same delivery</p>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRunsOffBat(r)}
                  className={`min-h-[48px] min-w-[48px] rounded-lg border text-sm font-bold ${
                    runsOffBat === r ? 'border-[#00e5ff] bg-[#00e5ff]/20' : 'border-[#1a2030]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStep(4)} className="w-full rounded-lg bg-[#00e5ff] py-2 text-sm font-semibold text-[#0a0a0f]">
              Next
            </button>
            <button type="button" onClick={() => setStep(2)} className="w-full text-sm text-[#4a5568]">
              Back
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <label className="block text-xs text-[#4a5568]">New batsman</label>
            <select
              value={newBatsmanId}
              onChange={(e) => setNewBatsmanId(e.target.value)}
              className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-2 py-2 text-sm"
            >
              <option value="">Select</option>
              {newBatOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={loading || !newBatsmanId}
              onClick={async () => {
                try {
                  await onConfirm(buildPayload())
                  reset()
                  onClose()
                } catch {
                  /* parent shows error */
                }
              }}
              className="w-full rounded-lg bg-[#f44336] py-3 font-semibold text-white disabled:opacity-40"
            >
              Confirm wicket
            </button>
            <button type="button" onClick={() => setStep(3)} className="w-full text-sm text-[#4a5568]">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
