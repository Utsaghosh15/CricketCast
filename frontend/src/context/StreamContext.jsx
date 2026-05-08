import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const StreamContext = createContext(null)

export function StreamProvider({ children }) {
  const [currentLatency, setCurrentLatencyState] = useState(0)
  const latencyRef = useRef(0)

  const setCurrentLatency = useCallback((v) => {
    const n = typeof v === 'number' && !Number.isNaN(v) ? v : 0
    latencyRef.current = n
    setCurrentLatencyState(n)
  }, [])

  const value = useMemo(
    () => ({ currentLatency, latencyRef, setCurrentLatency }),
    [currentLatency, setCurrentLatency]
  )

  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
}

export function useStream() {
  const ctx = useContext(StreamContext)
  if (!ctx) throw new Error('useStream must be used within StreamProvider')
  return ctx
}
