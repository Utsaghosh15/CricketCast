import { useCallback, useEffect, useState } from 'react'

const LS_KEY = 'criccast_admin_secret'

export default function AdminGate({ children }) {
  const [ok, setOk] = useState(false)
  const secret = import.meta.env.VITE_ADMIN_SECRET || ''

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(LS_KEY)
    if (stored && stored === secret) setOk(true)
  }, [secret])

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const pwd = String(fd.get('password') || '')
      if (pwd === secret) {
        localStorage.setItem(LS_KEY, pwd)
        setOk(true)
      } else {
        alert('Invalid admin password')
      }
    },
    [secret]
  )

  if (!secret) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e0e0e0] flex items-center justify-center p-4">
        <p className="text-center text-[#4a5568]">Missing VITE_ADMIN_SECRET in environment.</p>
      </div>
    )
  }

  if (!ok) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e0e0e0] flex items-center justify-center p-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm rounded-xl border border-[#1a2030] bg-[#0d1117] p-6 space-y-4"
        >
          <h1 className="text-xl font-semibold text-center">CricCast Admin</h1>
          <p className="text-sm text-[#4a5568] text-center">Enter the scorer password to continue.</p>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            className="w-full rounded-lg border border-[#1a2030] bg-[#0a0a0f] px-3 py-2 text-[#e0e0e0] outline-none focus:border-[#00e5ff]"
            placeholder="Password"
            required
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-[#00e5ff] py-2.5 font-medium text-[#0a0a0f]"
          >
            Unlock
          </button>
        </form>
      </div>
    )
  }

  return children
}
