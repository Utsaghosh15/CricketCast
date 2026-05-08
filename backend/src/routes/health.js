const express = require('express');
const { pool } = require('../db/pool');
const { getPublisher } = require('../redis/publisher');

const router = express.Router();

/**
 * Liveness and dependency checks.
 */
router.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    await getPublisher().ping();
    return res.json({
      data: { ok: true, postgres: true, redis: true },
      message: 'OK',
    });
  } catch (e) {
    console.error('[health]', e.message);
    return res.status(503).json({
      error: e.message || 'Health check failed',
      code: 'HEALTH_ERROR',
    });
  }
});

module.exports = router;
