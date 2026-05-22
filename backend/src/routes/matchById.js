const express = require('express');
const matchDB = require('../db/matchDB');
const { getMatchState } = require('../engine/scoreEngine');
const { verifyViewerToken } = require('../utils/viewerJwt');
const { verifyAdminToken } = require('../utils/adminJwt');
const { redactMatchState } = require('../utils/redactMatchStreams');

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

    const adminSecret = (req.headers['x-admin-secret'] || '').trim();
    const expected = process.env.ADMIN_SECRET || 'criccast';

    const auth = req.headers.authorization || '';
    const bearer = auth.match(/^Bearer\s+(.+)$/i);
    let adminOk = false;
    let viewerOk = false;
    if (bearer) {
      const token = bearer[1];
      if (verifyAdminToken(token)) adminOk = true;
      else {
        const v = verifyViewerToken(token);
        viewerOk = !!(v && v.matchId === req.params.id);
      }
    }
    if (!adminOk) {
      adminOk = adminSecret === expected;
    }

    if (adminOk || viewerOk) {
      return res.json({ data: state, message: 'OK' });
    }
    return res.json({ data: redactMatchState(state), message: 'OK' });
  } catch (e) {
    console.error('[match get]', e);
    return err(res, 500, 'INTERNAL', 'Failed to load match');
  }
});

/**
 * Record a drinks / innings / rain / resume control (no DB row yet — avoids 404 from scorer UI).
 */
router.post('/break', async (req, res) => {
  try {
    const matchId = req.params.id;
    const action = (req.body && req.body.action) || '';
    const allowed = new Set(['DRINKS', 'INNINGS', 'RAIN', 'RESUME']);
    if (!allowed.has(action)) {
      return err(res, 400, 'INVALID_ACTION', 'Unknown break action');
    }
    const state = await getMatchState(matchId);
    if (!state) return err(res, 404, 'NOT_FOUND', 'Match not found');
    return res.json({ data: state, message: 'Break recorded' });
  } catch (e) {
    console.error('[match break]', e);
    return err(res, 500, 'INTERNAL', 'Failed to record break');
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
