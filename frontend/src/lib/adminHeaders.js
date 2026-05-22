const LS_ADMIN = 'criccast_admin_secret'
const LS_ADMIN_TOKEN = 'criccast_admin_token'

/** Headers for admin API routes (Bearer from /api/auth/admin-login or legacy X-Admin-Secret). */
export function adminHeaders() {
  if (typeof localStorage === 'undefined') return {}
  const tok = localStorage.getItem(LS_ADMIN_TOKEN)?.trim()
  if (tok) return { Authorization: `Bearer ${tok}` }
  const secret = localStorage.getItem(LS_ADMIN)?.trim()
  return secret ? { 'X-Admin-Secret': secret } : {}
}
