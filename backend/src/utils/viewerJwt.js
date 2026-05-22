const jwt = require('jsonwebtoken');

/**
 * @returns {string}
 */
function getSecret() {
  return process.env.VIEWER_JWT_SECRET || process.env.ADMIN_SECRET || 'dev_viewer_secret_change_me';
}

/**
 * @param {{ guestId: string, matchId: string, email: string }} payload
 * @returns {string}
 */
function signViewerToken(payload) {
  return jwt.sign(
    {
      typ: 'viewer',
      gid: payload.guestId,
      mid: payload.matchId,
      em: payload.email,
    },
    getSecret(),
    { expiresIn: process.env.VIEWER_JWT_EXPIRES || '7d' }
  );
}

/**
 * @param {string} token
 * @returns {{ guestId: string, matchId: string, email: string }|null}
 */
function verifyViewerToken(token) {
  if (!token) return null;
  try {
    const p = jwt.verify(token, getSecret());
    if (p.typ !== 'viewer' || !p.gid || !p.mid) return null;
    return { guestId: p.gid, matchId: p.mid, email: p.em };
  } catch {
    return null;
  }
}

module.exports = { signViewerToken, verifyViewerToken, getSecret };
