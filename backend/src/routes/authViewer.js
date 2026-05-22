const express = require('express');
const bcrypt = require('bcrypt');
const roomGuestDB = require('../db/roomGuestDB');
const { signViewerToken } = require('../utils/viewerJwt');

const router = express.Router();

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Viewer login for a match (email + temp password from invite).
 * POST /api/auth/viewer-login
 */
router.post('/viewer-login', async (req, res) => {
  try {
    const { matchId, email, password } = req.body || {};
    if (!matchId || !email || !password) {
      return err(res, 400, 'VALIDATION', 'matchId, email, and password are required');
    }
    const guest = await roomGuestDB.findGuestByEmail(matchId, email);
    if (!guest) {
      return err(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const ok = await bcrypt.compare(String(password), guest.password_hash);
    if (!ok) {
      return err(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const token = signViewerToken({
      guestId: guest.id,
      matchId,
      email: guest.email,
    });
    return res.json({
      data: {
        token,
        guest: {
          id: guest.id,
          email: guest.email,
          displayName: guest.display_name,
          canPublish: guest.can_publish,
        },
      },
      message: 'OK',
    });
  } catch (e) {
    console.error('[viewer-login]', e);
    return err(res, 500, 'INTERNAL', 'Login failed');
  }
});

module.exports = router;
