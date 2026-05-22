import { useCallback, useEffect, useState } from 'react'
import { http, unwrap } from '../lib/http'

const LS_TOKEN = 'criccast_admin_token'
const LS_LEGACY = 'criccast_admin_secret'

export default function AdminGate({ children }) {
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tok = localStorage.getItem(LS_TOKEN)?.trim()
    if (tok) setOk(true)
  }, [])

  const onSubmit = useCallback(async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    const fd = new FormData(e.target)
    const username = String(fd.get('username') || '').trim()
    const password = String(fd.get('password') || '')
    try {
      const res = await http.post('/api/auth/admin-login', { username, password })
      const token = unwrap(res)?.token
      if (!token) throw new Error('No token returned')
      try {
        localStorage.setItem(LS_TOKEN, token)
        localStorage.removeItem(LS_LEGACY)
      } catch {
        /* ignore */
      }
      setOk(true)
    } catch (ex) {
      setErr(ex?.response?.data?.error || ex.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }, [])

  if (!ok) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e0e0e0] flex items-center justify-center p-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm rounded-xl border border-[#1a2030] bg-[#0d1117] p-6 space-y-4"
        >
          <h1 className="text-xl font-semibold text-center">CricCast Admin</h1>
          <p className="text-sm text-[#4a5568] text-center">
            Sign in with scorer credentials. Defaults if unset in <code className="text-[#8899aa]">backend/.env</code>:{' '}
            <strong className="text-[#e0e0e0]">admin</strong> / <strong className="text-[#e0e0e0]">criccast</strong>
          </p>
          <input
            type="text"
            name="username"
            autoComplete="username"
            defaultValue="admin"
            className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
            placeholder="Username"
            required
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            defaultValue="criccast"
            className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
            placeholder="Password"
            required
          />
          {err && <p className="text-center text-xs text-[#f44336]">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#00e5ff] py-2.5 font-medium text-[#0a0a0f] disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Unlock'}
          </button>
        </form>
      </div>
    )
  }

  return children
}
