const jwt = require('jsonwebtoken');

/** @returns {string} */
function getAdminSigningSecret() {
  return process.env.ADMIN_SECRET || 'criccast';
}

/**
 * @returns {string}
 */
function signAdminToken() {
  return jwt.sign({ typ: 'admin' }, getAdminSigningSecret(), {
    expiresIn: process.env.ADMIN_JWT_EXPIRES || '7d',
  });
}

/**
 * @param {string} token
 * @returns {object|null}
 */
function verifyAdminToken(token) {
  if (!token) return null;
  try {
    const p = jwt.verify(token, getAdminSigningSecret());
    if (p.typ !== 'admin') return null;
    return p;
  } catch {
    return null;
  }
}

module.exports = { signAdminToken, verifyAdminToken, getAdminSigningSecret };
