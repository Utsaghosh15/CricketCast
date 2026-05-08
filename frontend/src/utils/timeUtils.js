/**
 * @param {number} ts epoch ms
 */
export function formatEventTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * @param {number} ts
 */
export function formatShortDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString()
}
