/**
 * pg often throws AggregateError with code ECONNREFUSED when nothing listens on DATABASE_URL.
 * @param {unknown} err
 * @returns {boolean}
 */
function isDatabaseUnreachable(err) {
  if (!err || typeof err !== 'object') return false
  if (err.code === 'ECONNREFUSED') return true
  if (err.code === '57P01') return true // admin_shutdown
  const nested = err.errors
  if (Array.isArray(nested)) {
    return nested.some((e) => e && (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND'))
  }
  return false
}

/** Wrong user/password in DATABASE_URL (or role does not exist). */
function isDatabaseAuthFailed(err) {
  if (!err || typeof err !== 'object') return false
  return err.code === '28P01'
}

/**
 * Map DB / pool errors to HTTP responses so the UI is not stuck on generic 500.
 * @param {import('express').Response} res
 * @param {unknown} err
 * @param {string} logLabel
 * @param {string} [genericMessage]
 */
function sendDbAwareError(res, err, logLabel, genericMessage = 'Request failed') {
  console.error(logLabel, err)
  if (isDatabaseUnreachable(err)) {
    return res.status(503).json({
      error:
        'Database is not reachable. Start PostgreSQL and ensure DATABASE_URL is correct. From backend/: docker compose up -d postgres redis',
      code: 'DATABASE_UNAVAILABLE',
    })
  }
  if (isDatabaseAuthFailed(err)) {
    return res.status(503).json({
      error:
        'PostgreSQL rejected DATABASE_URL (wrong password or user). For Docker: POSTGRES_PASSWORD is only applied on first data volume; fix password in .env or run "docker compose down -v" then "docker compose up -d postgres redis" (deletes DB). For local Postgres: use credentials that exist.',
      code: 'DATABASE_AUTH_FAILED',
    })
  }
  return res.status(500).json({ error: genericMessage, code: 'INTERNAL' })
}

module.exports = { isDatabaseUnreachable, isDatabaseAuthFailed, sendDbAwareError }
