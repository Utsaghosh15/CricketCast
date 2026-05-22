import { useState } from 'react'
import { http, unwrap } from '../../lib/http'

const LS_KEY = (matchId) => `criccast_viewer_jwt_${matchId}`

/**
 * Email + temp password gate for match viewers (LiveKit room).
 * @param {{ matchId: string, onLoggedIn: (token: string) => void }} props
 */
export default function MatchViewerLogin({ matchId, onLoggedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const res = await http.post('/api/auth/viewer-login', {
        matchId,
        email: email.trim(),
        password,
      })
      const token = unwrap(res)?.token
      if (!token) throw new Error('No token returned')
      try {
        sessionStorage.setItem(LS_KEY(matchId), token)
      } catch {
        /* ignore */
      }
      onLoggedIn(token)
    } catch (ex) {
      setErr(ex?.response?.data?.error || ex.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-[#1a2030] bg-[#0d1117] p-4">
      <h2 className="mb-1 text-sm font-semibold text-[#e0e0e0]">Viewer login</h2>
      <p className="mb-3 text-[11px] leading-relaxed text-[#4a5568]">
        Enter the email and temporary password from your invite. If the host configured email on the server, check your
        inbox; otherwise they will share the password with you directly. Only invited viewers can open the stream and
        LiveKit room.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="min-w-[200px] flex-1 rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Temporary password"
          className="min-w-[160px] flex-1 rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#00e5ff] px-4 py-2 text-sm font-semibold text-[#0a0a0f] disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {err && <p className="mt-2 text-xs text-[#f44336]">{err}</p>}
    </div>
  )
}

export function readViewerJwt(matchId) {
  try {
    return sessionStorage.getItem(LS_KEY(matchId)) || ''
  } catch {
    return ''
  }
}

export function clearViewerJwt(matchId) {
  try {
    sessionStorage.removeItem(LS_KEY(matchId))
  } catch {
    /* ignore */
  }
}
