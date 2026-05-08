import { useCallback, useEffect, useState } from 'react'
import { http, unwrap } from '../lib/http'

/**
 * @param {string} matchId
 * @param {{ enabled?: boolean }} [opts]
 */
export function useMatchData(matchId, opts = {}) {
  const { enabled = true } = opts
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!matchId || !enabled) return null
    setLoading(true)
    setError(null)
    try {
      const res = await http.get(`/api/match/${matchId}`)
      const data = unwrap(res)
      setState(data)
      return data
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load match')
      return null
    } finally {
      setLoading(false)
    }
  }, [enabled, matchId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { state, loading, error, refetch, setState }
}
