import { useOverlay } from '../../context/OverlayContext'

export default function AutoOverlayToggles() {
  const { autoSettings, setAutoSettings } = useOverlay()

  const rows = [
    { key: 'six', label: 'Six banner' },
    { key: 'four', label: 'Four banner' },
    { key: 'wicket', label: 'Wicket banner' },
    { key: 'overSummary', label: 'Over summary' },
    { key: 'scoreUpdate', label: 'Score update' },
  ]

  return (
    <div className="rounded-xl border border-[#1a2030] bg-[#0d1117] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#e0e0e0]">Auto overlays</h3>
      <ul className="space-y-3">
        {rows.map(({ key, label }) => (
          <li key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-[#4a5568]">{label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoSettings[key]}
              onClick={() => setAutoSettings({ [key]: !autoSettings[key] })}
              className={`relative h-7 w-12 rounded-full transition ${autoSettings[key] ? 'bg-[#00e5ff]' : 'bg-[#1a2030]'}`}
            >
              <span
                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-[#0a0a0f] transition-transform ${
                  autoSettings[key] ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
