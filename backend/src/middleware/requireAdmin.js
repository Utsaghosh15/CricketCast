const { verifyAdminToken } = require('../utils/adminJwt');

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Admin: Bearer admin JWT (from POST /api/auth/admin-login) or legacy X-Admin-Secret === ADMIN_SECRET.
 */
function requireAdmin(req, res, next) {
  const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (m) {
    const p = verifyAdminToken(m[1]);
    if (p) return next();
  }
  const adminSecret = (req.headers['x-admin-secret'] || '').trim();
  const expected = process.env.ADMIN_SECRET || 'criccast';
  if (adminSecret && adminSecret === expected) return next();
  return err(res, 401, 'UNAUTHORIZED', 'Invalid or missing admin credentials');
}

module.exports = { requireAdmin };
