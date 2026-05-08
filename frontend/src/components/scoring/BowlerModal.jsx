export default function BowlerModal({ open, onClose, players, currentBowlerId, onPick, loading }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-xl border border-[#1a2030] bg-[#0d1117] p-4">
        <h2 className="mb-3 text-lg font-semibold">Next bowler</h2>
        <ul className="space-y-2">
          {players
            .filter((p) => p.id !== currentBowlerId)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onPick(p.id)}
                  className="w-full rounded-lg border border-[#1a2030] py-2 text-left px-3 text-sm hover:border-[#00e5ff]/50 disabled:opacity-40"
                >
                  {p.name}
                </button>
              </li>
            ))}
        </ul>
        <button type="button" onClick={onClose} className="mt-4 w-full text-sm text-[#4a5568]">
          Cancel
        </button>
      </div>
    </div>
  )
}
