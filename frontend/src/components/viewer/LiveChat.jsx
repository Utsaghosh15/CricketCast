import { useCallback, useEffect, useRef, useState } from 'react'

const DISPLAY_LS = 'criccast-display-name'
const QUICK_REACTIONS = ['👏', '🔥', '❤️', '😂', '⚡', '🏏']

/**
 * Match-room chat: server relays into LiveKit so every participant (and the host panel) sees the same feed.
 *
 * @param {{
 *   messages: Array<{ id: string, displayName: string, text: string|null, emoji: string|null, ts: number }>
 *   viewerLoggedIn: boolean
 *   lkConnected: boolean
 *   lkConnecting: boolean
 *   lkError: string
 *   canPublish: boolean
 *   sendLiveKit: (payload: { displayName: string, text?: string|null, emoji?: string|null }) => Promise<boolean>
 *   onReconnectLiveKit: () => void
 * }} props
 */
export default function LiveChat({
  messages,
  viewerLoggedIn,
  lkConnected,
  lkConnecting,
  lkError,
  canPublish,
  sendLiveKit,
  onReconnectLiveKit,
}) {
  const [text, setText] = useState('')
  const [displayName, setDisplayName] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(DISPLAY_LS) || '' : ''
    } catch {
      return ''
    }
  })
  const listRef = useRef(null)

  const persistName = useCallback((name) => {
    const trimmed = name.trim().slice(0, 40)
    setDisplayName(trimmed)
    try {
      localStorage.setItem(DISPLAY_LS, trimmed)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const canSend = viewerLoggedIn && !!displayName.trim()

  const sendText = async () => {
    const t = text.trim()
    if (!t || !displayName.trim()) return
    const ok = await sendLiveKit({ displayName: displayName.trim(), text: t, emoji: null })
    if (ok) setText('')
  }

  const sendReaction = async (emoji) => {
    if (!displayName.trim()) return
    await sendLiveKit({ displayName: displayName.trim(), text: null, emoji })
  }

  const statusLine = (() => {
    if (lkConnecting) return 'Connecting to LiveKit (tiles)…'
    if (lkError) return `LiveKit: ${lkError}`
    if (viewerLoggedIn && !lkConnected) return 'Chat: server relay — messages still go to the room. Reconnect LiveKit for video tiles.'
    if (lkConnected && !canPublish)
      return 'LiveKit tiles ✓ — if the host enabled your camera, permission refreshes automatically (or tap Reconnect LiveKit).'
    if (lkConnected) return 'LiveKit tiles + chat ✓'
    return 'Sign in with your invite to use chat.'
  })()

  return (
    <div className="mt-4 rounded-xl border border-[#1a2030] bg-[#0d1117] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#e0e0e0]">Live chat (LiveKit room)</span>
        <button
          type="button"
          onClick={onReconnectLiveKit}
          className="text-[10px] text-[#00e5ff] underline"
        >
          Reconnect LiveKit
        </button>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-[#4a5568]">
        Invited viewers and the scoring host see the same thread. Camera controls are in the highlighted bar above when
        the host allows publishing.
      </p>
      <p className="mb-3 text-[10px] font-medium text-cyan-200/70">{statusLine}</p>

      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={displayName}
          onChange={(e) => persistName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-2 py-1.5 text-xs text-[#e0e0e0] outline-none focus:border-[#00e5ff] sm:max-w-[160px]"
        />
        <div className="flex flex-wrap gap-1">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              disabled={!canSend}
              onClick={() => void sendReaction(e)}
              className="rounded-md border border-[#1a2030] bg-[#0a0a0f] px-2 py-1 text-base leading-none hover:border-[#00e5ff]/50 disabled:opacity-40"
              title="Send reaction"
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={listRef}
        className="mb-3 max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-[#1a2030] bg-[#0a0a0f] p-2 text-xs"
      >
        {messages.length === 0 ? (
          <p className="text-[#4a5568]">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-[#c5cdd8]">
              <span className="font-semibold text-[#00e5ff]/90">{m.displayName}</span>
              {m.emoji && <span className="ml-2 text-base">{m.emoji}</span>}
              {m.text && <span className="ml-2">{m.text}</span>}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void sendText()}
          maxLength={500}
          placeholder="Message…"
          disabled={!canSend}
          className="min-w-0 flex-1 rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-2 py-2 text-sm text-[#e0e0e0] outline-none focus:border-[#00e5ff] disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!canSend || !text.trim() || !displayName.trim()}
          onClick={() => void sendText()}
          className="shrink-0 rounded-lg bg-[#00e5ff] px-4 py-2 text-sm font-semibold text-[#0a0a0f] disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}
