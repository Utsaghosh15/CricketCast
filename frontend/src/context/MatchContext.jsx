import { createContext, useCallback, useContext, useMemo } from 'react'
import { useMatchData } from '../hooks/useMatchData'

const MatchContext = createContext(null)

/**
 * @param {{ children: import('react').ReactNode, matchId: string }} props
 */
export function MatchProvider({ children, matchId }) {
  const { state, loading, error, refetch, setState } = useMatchData(matchId)

  const updateFromServer = useCallback(
    (next) => {
      setState(next)
    },
    [setState]
  )

  const value = useMemo(
    () => ({
      matchState: state,
      matchLoading: loading,
      matchError: error,
      refetch,
      updateFromServer,
    }),
    [state, loading, error, refetch, updateFromServer]
  )

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>
}

export function useMatch() {
  const ctx = useContext(MatchContext)
  if (!ctx) throw new Error('useMatch must be used within MatchProvider')
  return ctx
}
