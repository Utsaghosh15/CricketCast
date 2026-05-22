import { useCallback, useEffect, useState } from 'react'
import { http, unwrap } from '../../lib/http'
import { adminHeaders } from '../../lib/adminHeaders'

/**
 * Admin: invite emails (temp passwords) + toggle LiveKit publish + show webhook presence log.
 * @param {{ matchId: string }} props
 */
export default function RoomGuestsAdmin({ matchId }) {
  const [guests, setGuests] = useState([])
  const [presence, setPresence] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [inviteOut, setInviteOut] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    try {
      const hasAuth =
        typeof localStorage !== 'undefined' &&
        (localStorage.getItem('criccast_admin_token')?.trim() || localStorage.getItem('criccast_admin_secret')?.trim())
      if (!hasAuth) {
        setErr('Sign in on the admin unlock screen first (username / password from backend ADMIN_USERNAME / ADMIN_PASSWORD).')
        setGuests([])
        setPresence([])
        return
      }
      const res = await http.get(`/api/match/${matchId}/room-guests`, { headers: adminHeaders() })
      const data = unwrap(res)
      setGuests(data.guests || [])
      setPresence(data.presence || [])
    } catch (e) {
      const status = e?.response?.status
      const msg = e?.response?.data?.error || e.message || 'Failed to load'
      setErr(
        status === 401
          ? `${msg} Use the same username/password as backend ADMIN_USERNAME / ADMIN_PASSWORD, or sign in again from /admin.`
          : msg
      )
    }
  }, [matchId])

  useEffect(() => {
    void load()
  }, [load])

  const invite = async () => {
    const raw = emailInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (raw.length === 0) {
      setErr('Enter at least one email')
      return
    }
    setLoading(true)
    setErr('')
    setInviteOut(null)
    try {
      const res = await http.post(
        `/api/match/${matchId}/room-guests`,
        { emails: raw },
        { headers: adminHeaders() }
      )
      setInviteOut(unwrap(res)?.invited || [])
      setEmailInput('')
      await load()
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Invite failed')
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async (guestId, canPublish) => {
    setLoading(true)
    setErr('')
    try {
      await http.patch(`/api/match/${matchId}/room-guests/${guestId}`, { canPublish }, { headers: adminHeaders() })
      await load()
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#1a2030] bg-[#0d1117] p-3 text-[#e0e0e0]">
      <h3 className="mb-2 text-sm font-semibold text-[#00e5ff]/90">LiveKit viewers</h3>
      <p className="mb-3 text-[10px] text-[#4a5568]">
        Uses the same admin password as this panel (<code className="text-[#8899aa]">X-Admin-Secret</code>). Temp
        passwords appear below after each invite — copy if you need them. If the API has{' '}
        <code className="text-[#8899aa]">SMTP_HOST</code> + <code className="text-[#8899aa]">INVITE_EMAIL_FROM</code>, each
        guest is emailed automatically.
      </p>

      <div className="mb-3 flex flex-col gap-2">
        <textarea
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          rows={3}
          placeholder="emails@comma-or-newline-separated"
          className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-2 py-2 text-xs text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void invite()}
          className="rounded-lg bg-[#00e5ff] px-3 py-2 text-xs font-semibold text-[#0a0a0f] disabled:opacity-50"
        >
          Invite / reset passwords
        </button>
      </div>

      {inviteOut?.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-100">
          <p className="mb-1 font-semibold">Temp passwords (copy now):</p>
          <ul className="space-y-1 font-mono">
            {inviteOut.map((r) => (
              <li key={r.id}>
                {r.email} → <strong>{r.tempPassword}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {err && <p className="mb-2 text-xs text-[#f44336]">{err}</p>}

      <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-[#1a2030] bg-[#0a0a0f] p-2 text-[10px]">
        <p className="mb-1 font-semibold text-[#8899aa]">Guests</p>
        {guests.length === 0 ? (
          <p className="text-[#4a5568]">No invites yet.</p>
        ) : (
          <ul className="space-y-2">
            {guests.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a2030]/50 pb-2 last:border-0">
                <span className="truncate">{g.email}</span>
                <span className="text-[#4a5568]">{g.can_publish ? 'camera allowed' : 'view only'}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={loading || g.can_publish}
                    onClick={() => void togglePublish(g.id, true)}
                    className="rounded border border-[#1a2030] px-2 py-0.5 text-[10px] hover:border-[#00e5ff]/50 disabled:opacity-40"
                  >
                    Allow camera
                  </button>
                  <button
                    type="button"
                    disabled={loading || !g.can_publish}
                    onClick={() => void togglePublish(g.id, false)}
                    className="rounded border border-[#1a2030] px-2 py-0.5 text-[10px] hover:border-[#f44336]/50 disabled:opacity-40"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="max-h-32 overflow-y-auto rounded-lg border border-[#1a2030] bg-[#0a0a0f] p-2 text-[10px]">
        <p className="mb-1 font-semibold text-[#8899aa]">LiveKit webhooks (recent)</p>
        {presence.length === 0 ? (
          <p className="text-[#4a5568]">No events yet — configure webhook URL in LiveKit Cloud.</p>
        ) : (
          <ul className="space-y-1 font-mono text-[#c5cdd8]">
            {presence.map((p) => (
              <li key={p.id}>
                {new Date(p.created_at).toLocaleTimeString()} · {p.event_type} · {p.participant_identity}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" onClick={() => void load()} className="mt-2 text-[10px] text-[#00e5ff] underline">
        Refresh
      </button>
    </div>
  )
}
