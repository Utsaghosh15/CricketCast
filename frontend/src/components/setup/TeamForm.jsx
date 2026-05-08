import { useCallback, useState } from 'react'

const ROLES = [
  { key: 'BATSMAN', label: 'Batsman' },
  { key: 'BOWLER', label: 'Bowler' },
  { key: 'ALL_ROUNDER', label: 'All-rounder' },
  { key: 'WICKET_KEEPER', label: 'Wicket Keeper' },
]

function newPlayer() {
  return {
    id: crypto.randomUUID(),
    name: '',
    jerseyNumber: '',
    role: 'BATSMAN',
  }
}

export default function TeamForm({ stepLabel, teamName, onTeamNameChange, players, onPlayersChange }) {
  const [draft, setDraft] = useState(newPlayer)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const addPlayer = useCallback(() => {
    if (!draft.name.trim()) return
    onPlayersChange([
      ...players,
      {
        ...draft,
        jerseyNumber: draft.jerseyNumber === '' ? null : Number(draft.jerseyNumber),
      },
    ])
    setDraft(newPlayer())
  }, [draft, onPlayersChange, players])

  const remove = (id) => {
    onPlayersChange(players.filter((p) => p.id !== id))
  }

  const onDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', String(index))
  }

  const onDrop = (e, toIndex) => {
    e.preventDefault()
    const from = Number(e.dataTransfer.getData('text/plain'))
    if (Number.isNaN(from)) return
    const next = [...players]
    const [moved] = next.splice(from, 1)
    next.splice(toIndex, 0, moved)
    onPlayersChange(next)
  }

  const applyPaste = () => {
    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const added = lines.map((name) => ({
      id: crypto.randomUUID(),
      name,
      jerseyNumber: null,
      role: 'BATSMAN',
    }))
    onPlayersChange([...players, ...added])
    setPasteText('')
    setPasteOpen(false)
  }

  const count = players.length

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">{stepLabel} name *</label>
        <input
          required
          value={teamName}
          onChange={(e) => onTeamNameChange(e.target.value)}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-3 text-lg text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
          placeholder="Team name"
        />
      </div>

      <div className="rounded-xl border border-[#1a2030] bg-[#0d1117] p-4 space-y-3">
        <p className="text-sm font-medium text-[#e0e0e0]">Add player</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0]"
            placeholder="Player name"
          />
          <input
            type="number"
            value={draft.jerseyNumber}
            onChange={(e) => setDraft((d) => ({ ...d, jerseyNumber: e.target.value }))}
            className="rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0]"
            placeholder="Jersey # (optional)"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, role: r.key }))}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                draft.role === r.key
                  ? 'bg-[#00e5ff] text-[#0a0a0f]'
                  : 'border border-[#1a2030] text-[#e0e0e0]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={addPlayer}
          className="w-full rounded-lg border border-[#00e5ff]/50 py-2 text-sm font-medium text-[#00e5ff]"
        >
          + Add Player
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className={`text-sm ${count < 11 ? 'text-amber-400' : 'text-[#4a5568]'}`}>
          {count} / 11 players
          {count < 11 ? ' — add at least 11 for a full squad' : ''}
        </p>
        <button
          type="button"
          onClick={() => setPasteOpen(true)}
          className="text-sm text-[#00e5ff]"
        >
          Paste Squad
        </button>
      </div>

      <ul className="space-y-2">
        {players.map((p, index) => (
          <li
            key={p.id}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, index)}
            className="flex items-center gap-2 rounded-lg border border-[#1a2030] bg-[#0d1117] px-3 py-2"
          >
            <span className="cursor-grab text-[#4a5568]" title="Drag to reorder">
              ⋮⋮
            </span>
            <span className="w-8 text-xs text-[#4a5568]">{p.jerseyNumber != null ? `#${p.jerseyNumber}` : '—'}</span>
            <span className="flex-1 truncate text-sm">{p.name}</span>
            <span className="rounded bg-[#1a2030] px-2 py-0.5 text-xs text-[#00e5ff]">{p.role}</span>
            <button type="button" onClick={() => remove(p.id)} className="text-[#f44336] px-2">
              ✕
            </button>
          </li>
        ))}
      </ul>

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-[#1a2030] bg-[#0d1117] p-4">
            <p className="mb-2 text-sm text-[#4a5568]">One player name per line</p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              className="mb-3 w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] p-2 text-sm text-[#e0e0e0]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="flex-1 rounded-lg border border-[#1a2030] py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyPaste}
                className="flex-1 rounded-lg bg-[#00e5ff] py-2 text-sm font-medium text-[#0a0a0f]"
              >
                Add names
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
