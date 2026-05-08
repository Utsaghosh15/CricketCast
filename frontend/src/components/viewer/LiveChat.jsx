import { useCallback, useEffect, useRef, useState } from 'react'

const DISPLAY_LS = 'criccast-display-name'
const QUICK_REACTIONS = ['👏', '🔥', '❤️', '😂', '⚡', '🏏']

/**
 * Match chat delivered over RTCDataChannel; WebSocket is used only for SDP/ICE signalling.
 *
 * @param {{
 *   matchId: string
 *   messages: Array<{ id: string, displayName: string, text: string|null, emoji: string|null, ts: number }>
 *   wsConnected: boolean
 *   dcState: string
 *   dcError: string | null
 *   sendDc: ((payload: object) => boolean) | null
 *   sendWs: ((obj: object) => boolean) | null
 * }} props
 */
export default function LiveChat({
  matchId,
  messages,
  wsConnected,
  dcState,
  dcError,
  sendDc,
  sendWs,
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

  const dcReady = dcState === 'open' && !!sendDc
  const wsRelayOk = !!(wsConnected && sendWs && matchId)
  const canDeliver = !!(displayName.trim() && (dcReady || wsRelayOk))
  const canCompose = !!(wsConnected && displayName.trim())

  const dispatchPayload = useCallback(
    (payload) => {
      if (dcReady && sendDc?.(payload)) return true
      if (wsRelayOk && sendWs) {
        return sendWs({
          type: 'CHAT_MESSAGE',
          matchId,
          payload,
        })
      }
      return false
    },
    [dcReady, sendDc, wsRelayOk, sendWs, matchId]
  )

  const sendText = () => {
    const t = text.trim()
    if (!t || !displayName.trim()) return
    if (!dispatchPayload({ displayName: displayName.trim(), text: t, emoji: null })) return
    setText('')
  }

  const sendReaction = (emoji) => {
    if (!displayName.trim()) return
    dispatchPayload({ displayName: displayName.trim(), text: null, emoji })
  }

  const statusLine = (() => {
    if (!wsConnected) return 'Signalling offline — waiting for WebSocket…'
    if (dcReady) return 'Sending over RTC DataChannel ✓'
    if (dcState === 'connecting')
      return 'Negotiating RTC DataChannel — you can type; messages send via WebSocket until the channel opens.'
    if (dcState === 'failed')
      return `RTC DataChannel unavailable (${dcError || 'failed'}) — using WebSocket relay.`
    if (dcState === 'closed') return 'RTC DataChannel closed — using WebSocket relay.'
    return wsRelayOk ? 'Using WebSocket relay for chat ✓' : 'Preparing chat…'
  })()

  return (
    <div className="mt-4 rounded-xl border border-[#1a2030] bg-[#0d1117] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#e0e0e0]">Live chat (RTC + WS fallback)</span>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-[#4a5568]">
        Prefer RTC <code className="text-[#8899aa]">DataChannel</code> (Node <code className="text-[#8899aa]">@roamhq/wrtc</code>
        relay) when negotiation succeeds; otherwise the same match WebSocket carries chat via Redis fan-out so you can always
        send while connected.
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
              disabled={!canDeliver}
              onClick={() => sendReaction(e)}
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
          onKeyDown={(e) => e.key === 'Enter' && sendText()}
          maxLength={500}
          placeholder="Message…"
          disabled={!canCompose}
          className="min-w-0 flex-1 rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-2 py-2 text-sm text-[#e0e0e0] outline-none focus:border-[#00e5ff] disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!canDeliver || !text.trim() || !displayName.trim()}
          onClick={sendText}
          className="shrink-0 rounded-lg bg-[#00e5ff] px-4 py-2 text-sm font-semibold text-[#0a0a0f] disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}
