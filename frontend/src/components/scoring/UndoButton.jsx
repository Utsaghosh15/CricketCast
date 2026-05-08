import { useState } from 'react'

export default function UndoButton({ disabled, onUndo, loading }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-[#1a2030] py-3 text-sm font-medium disabled:opacity-40"
      >
        ↩ Undo
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-56 rounded-lg border border-[#1a2030] bg-[#0a0a0f] p-3 shadow-xl">
          <p className="mb-2 text-xs text-[#4a5568]">Undo last ball?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded border border-[#1a2030] py-1.5 text-xs">
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                await onUndo()
                setOpen(false)
              }}
              className="flex-1 rounded bg-[#f44336] py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
