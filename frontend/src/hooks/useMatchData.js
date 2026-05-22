import { useCallback, useEffect, useState } from 'react'
import { http, unwrap } from '../lib/http'

const LS_ADMIN = 'criccast_admin_secret'
const LS_ADMIN_TOKEN = 'criccast_admin_token'

/**
 * @param {string} matchId
 * @param {{ enabled?: boolean, matchAudience?: 'public' | 'viewer' | 'admin', viewerAuthToken?: string }} [opts]
 */
export function useMatchData(matchId, opts = {}) {
  const { enabled = true, matchAudience = 'public', viewerAuthToken = '' } = opts
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!matchId || !enabled) return null
    setLoading(true)
    setError(null)
    try {
      const headers = {}
      if (matchAudience === 'viewer' && viewerAuthToken) {
        headers.Authorization = `Bearer ${viewerAuthToken}`
      } else if (matchAudience === 'admin') {
        try {
          const tok = localStorage.getItem(LS_ADMIN_TOKEN)?.trim()
          if (tok) headers.Authorization = `Bearer ${tok}`
          else {
            const s = localStorage.getItem(LS_ADMIN)?.trim()
            if (s) headers['X-Admin-Secret'] = s
          }
        } catch {
          /* ignore */
        }
      }
      const res = await http.get(`/api/match/${matchId}`, { headers })
      const data = unwrap(res)
      setState(data)
      return data
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load match')
      return null
    } finally {
      setLoading(false)
    }
  }, [enabled, matchId, matchAudience, viewerAuthToken])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { state, loading, error, refetch, setState }
}
