export default function TossForm({
  team1Name,
  team2Name,
  team1Players,
  team2Players,
  tossWinner,
  tossElected,
  onTossChange,
  strikerId,
  nonStrikerId,
  bowlerId,
  onOpeningChange,
}) {
  const battingTeam = tossWinner === 'team1' ? (tossElected === 'bat' ? 'team1' : 'team2') : tossElected === 'bat' ? 'team2' : 'team1'
  const battingPlayers = battingTeam === 'team1' ? team1Players : team2Players
  const bowlingPlayers = battingTeam === 'team1' ? team2Players : team1Players

  return (
    <div className="space-y-6">
      <div>
        <span className="mb-2 block text-sm text-[#4a5568]">Toss won by</span>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'team1', label: team1Name || 'Team 1' },
            { id: 'team2', label: team2Name || 'Team 2' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTossChange({ winner: t.id })}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tossWinner === t.id
                  ? 'bg-[#00e5ff] text-[#0a0a0f]'
                  : 'border border-[#1a2030] bg-[#0d1117] text-[#e0e0e0]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm text-[#4a5568]">Elected to</span>
        <div className="flex gap-2">
          {['bat', 'bowl'].map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => onTossChange({ elected: x })}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                tossElected === x
                  ? 'bg-[#00e5ff] text-[#0a0a0f]'
                  : 'border border-[#1a2030] bg-[#0d1117] text-[#e0e0e0]'
              }`}
            >
              {x}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Opening striker</label>
        <select
          required
          value={strikerId}
          onChange={(e) => onOpeningChange({ strikerId: e.target.value })}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0]"
        >
          <option value="">Select batsman</option>
          {battingPlayers.map((p, i) => (
            <option key={p.id} value={p.id}>
              {i + 1}. {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Opening non-striker</label>
        <select
          required
          value={nonStrikerId}
          onChange={(e) => onOpeningChange({ nonStrikerId: e.target.value })}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0]"
        >
          <option value="">Select batsman</option>
          {battingPlayers
            .filter((p) => p.id !== strikerId)
            .map((p, i) => (
              <option key={p.id} value={p.id}>
                {i + 1}. {p.name}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[#4a5568]">Opening bowler</label>
        <select
          required
          value={bowlerId}
          onChange={(e) => onOpeningChange({ bowlerId: e.target.value })}
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0]"
        >
          <option value="">Select bowler</option>
          {bowlingPlayers.map((p, i) => (
            <option key={p.id} value={p.id}>
              {i + 1}. {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
