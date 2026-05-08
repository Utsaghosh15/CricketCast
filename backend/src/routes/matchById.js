const express = require('express');
const matchDB = require('../db/matchDB');
const { getMatchState } = require('../engine/scoreEngine');

const router = express.Router({ mergeParams: true });

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Mark match LIVE.
 */
router.post('/golive', async (req, res) => {
  try {
    const row = await matchDB.setMatchStatus(req.params.id, 'LIVE');
    if (!row) return err(res, 404, 'NOT_FOUND', 'Match not found');
    const state = await getMatchState(req.params.id);
    console.log('[match] golive', req.params.id);
    return res.json({ data: state, message: 'Match is live' });
  } catch (e) {
    console.error('[match golive]', e);
    return err(res, 500, 'INTERNAL', 'Failed to go live');
  }
});

/**
 * Full match state snapshot.
 */
router.get('/', async (req, res) => {
  try {
    const state = await getMatchState(req.params.id);
    if (!state) return err(res, 404, 'NOT_FOUND', 'Match not found');
    return res.json({ data: state, message: 'OK' });
  } catch (e) {
    console.error('[match get]', e);
    return err(res, 500, 'INTERNAL', 'Failed to load match');
  }
});

/**
 * Complete match.
 */
router.post('/complete', async (req, res) => {
  try {
    const { result, manOfMatch } = req.body || {};
    const row = await matchDB.setMatchStatus(req.params.id, 'COMPLETE', {
      result_text: result || null,
      man_of_match_id: manOfMatch || null,
    });
    if (!row) return err(res, 404, 'NOT_FOUND', 'Match not found');
    const state = await getMatchState(req.params.id);
    console.log('[match] complete', req.params.id);
    return res.json({ data: state, message: 'Match completed' });
  } catch (e) {
    console.error('[match complete]', e);
    return err(res, 500, 'INTERNAL', 'Failed to complete match');
  }
});

module.exports = router;
