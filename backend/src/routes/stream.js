const express = require('express');
const matchDB = require('../db/matchDB');
const { pool } = require('../db/pool');

const router = express.Router({ mergeParams: true });

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Save playback URL and stream key (MediaMTX or compatible provider).
 */
router.post('/stream', async (req, res) => {
  try {
    const { streamUrl, streamKey } = req.body || {};
    if (!streamUrl || !streamKey) {
      return err(res, 400, 'VALIDATION', 'streamUrl and streamKey are required');
    }
    const row = await matchDB.updateMatchStream(req.params.id, { streamUrl, streamKey });
    if (!row) return err(res, 404, 'NOT_FOUND', 'Match not found');
    return res.json({ data: row, message: 'Stream updated' });
  } catch (e) {
    console.error('[stream POST]', e);
    return err(res, 500, 'INTERNAL', 'Failed to update stream');
  }
});

/**
 * Return stream URL and live flags.
 */
router.get('/stream', async (req, res) => {
  try {
    const row = await matchDB.getMatchRow(pool, req.params.id);
    if (!row) return err(res, 404, 'NOT_FOUND', 'Match not found');
    return res.json({
      data: {
        streamUrl: row.stream_url,
        isLive: row.status === 'LIVE',
        matchStatus: row.status,
      },
      message: 'OK',
    });
  } catch (e) {
    console.error('[stream GET]', e);
    return err(res, 500, 'INTERNAL', 'Failed to load stream');
  }
});

module.exports = router;
