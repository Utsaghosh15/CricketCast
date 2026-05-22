const express = require('express');
const { signAdminToken } = require('../utils/adminJwt');

const router = express.Router();

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Scorer login — default dev: admin / criccast (override with ADMIN_USERNAME, ADMIN_PASSWORD).
 * POST /api/auth/admin-login
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const u = process.env.ADMIN_USERNAME || 'admin';
    const p = process.env.ADMIN_PASSWORD || 'criccast';
    if (!username || !password) {
      return err(res, 400, 'VALIDATION', 'username and password are required');
    }
    if (String(username) !== u || String(password) !== p) {
      return err(res, 401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }
    const token = signAdminToken();
    return res.json({
      data: { token },
      message: 'OK',
    });
  } catch (e) {
    console.error('[admin-login]', e);
    return err(res, 500, 'INTERNAL', 'Login failed');
  }
});

module.exports = router;
