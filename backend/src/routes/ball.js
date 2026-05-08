const express = require('express');
const { pool } = require('../db/pool');
const matchDB = require('../db/matchDB');
const ballDB = require('../db/ballDB');
const inningsEngine = require('../engine/inningsEngine');
const { getMatchState } = require('../engine/scoreEngine');
const { detectEvent } = require('../engine/eventEngine');
const { buildOverlayData } = require('../engine/overlayEngine');
const { publish } = require('../redis/publisher');

const router = express.Router({ mergeParams: true });

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Log overlay row and publish overlay channel.
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} matchId
 * @param {string} type
 * @param {object} payload
 */
async function logAndPublishOverlay(db, matchId, type, payload) {
  await db.query(
    `INSERT INTO overlay_log (match_id, type, triggered_by, payload) VALUES ($1, $2, 'AUTO', $3::jsonb)`,
    [matchId, type, JSON.stringify(payload)]
  );
  await publish(`match:overlays:${matchId}`, { type, payload, triggeredBy: 'AUTO' });
  console.log('[overlay auto]', matchId, type);
}

/**
 * Record a delivery with full scoring pipeline.
 */
router.post('/ball', async (req, res) => {
  const matchId = req.params.id;
  let prevState = null;
  try {
    prevState = await getMatchState(matchId);
    if (!prevState) return err(res, 404, 'NOT_FOUND', 'Match not found');
  } catch (e) {
    console.error('[ball] prev state', e);
    return err(res, 500, 'INTERNAL', 'Failed to load match');
  }

  const b = req.body || {};
  const body = {
    type: b.type,
    runsOffBat: b.runsOffBat ?? 0,
    extraRuns: b.extraRuns ?? 0,
    dismissalType: b.dismissalType || null,
    dismissedPlayerId: b.dismissedPlayerId || null,
    fielderId: b.fielderId || null,
    newBatsmanId: b.newBatsmanId || null,
    totalRuns: b.totalRuns,
  };

  if (!body.type) {
    return err(res, 400, 'VALIDATION', 'type is required');
  }

  let dismissedCard = null;
  if (body.type === 'WICKET' && body.dismissedPlayerId) {
    try {
      const c = await pool.connect();
      try {
        const inn = await matchDB.getCurrentInningsRow(c, matchId);
        if (inn) {
          dismissedCard = await ballDB.getBattingCard(c, inn.id, body.dismissedPlayerId);
        }
      } finally {
        c.release();
      }
    } catch (_) {}
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inn = await matchDB.getCurrentInningsRow(client, matchId);
    if (!inn) {
      await client.query('ROLLBACK');
      return err(res, 400, 'INNINGS_NOT_FOUND', 'No active innings');
    }
    await inningsEngine.recordNewBall(client, inn, body);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ball] record', e);
    if (e.code === 'OVER_PENDING_END') {
      return err(res, 400, e.code, 'End the over before continuing');
    }
    if (e.code === 'NEW_BATSMAN_REQUIRED') {
      return err(res, 400, e.code, 'newBatsmanId is required for wickets');
    }
    return err(res, 500, 'INTERNAL', 'Failed to record ball');
  } finally {
    client.release();
  }

  let newState;
  try {
    newState = await getMatchState(matchId);
  } catch (e) {
    console.error('[ball] new state', e);
    return err(res, 500, 'INTERNAL', 'Ball saved but failed to load state');
  }

  const { events } = detectEvent(body, prevState, newState);
  for (const ev of events) {
    try {
      await publish(`match:events:${matchId}`, ev);
      await pool.query(
        `INSERT INTO overlay_log (match_id, type, triggered_by, payload) VALUES ($1, $2, 'AUTO', $3::jsonb)`,
        [matchId, ev.type, JSON.stringify(ev)]
      );
    } catch (e) {
      console.error('[ball] publish event', e.message);
    }
  }

  const primary = events[0];
  if (primary && ['SIX', 'FOUR', 'WICKET'].includes(primary.type)) {
    try {
      const ov =
        primary.type === 'WICKET'
          ? buildOverlayData('WICKET', newState, {
              playerOut: primary.payload.playerOut,
              dismissal: primary.payload.dismissalType,
              runsOffBat: dismissedCard ? Number(dismissedCard.runs) : 0,
              ballsFaced: dismissedCard ? Number(dismissedCard.balls) : 0,
            })
          : buildOverlayData(primary.type, newState);
      await logAndPublishOverlay(pool, matchId, ov.type, ov);
    } catch (e) {
      console.error('[ball] auto overlay', e.message);
    }
  }

  console.log('[ball] recorded', matchId, body.type);
  return res.json({ data: newState, message: 'Ball recorded' });
});

/**
 * Undo last ball of current innings.
 */
router.post('/undo', async (req, res) => {
  const matchId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await inningsEngine.undoLastBall(client, matchId);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ball undo]', e);
    if (e.code === 'NO_BALL_TO_UNDO') {
      return err(res, 400, e.code, 'Nothing to undo');
    }
    return err(res, 500, 'INTERNAL', 'Failed to undo ball');
  } finally {
    client.release();
  }

  let newState;
  try {
    newState = await getMatchState(matchId);
  } catch (e) {
    return err(res, 500, 'INTERNAL', 'Undo applied but failed to load state');
  }

  const ev = {
    type: 'SCORE_UPDATE',
    matchId,
    realWorldTime: Date.now(),
    payload: { state: newState },
  };
  try {
    await publish(`match:events:${matchId}`, ev);
    await pool.query(
      `INSERT INTO overlay_log (match_id, type, triggered_by, payload) VALUES ($1, $2, 'AUTO', $3::jsonb)`,
      [matchId, ev.type, JSON.stringify(ev)]
    );
    console.log('[ball] undo', matchId);
  } catch (e) {
    console.error('[ball] undo publish', e.message);
  }

  return res.json({ data: newState, message: 'Last ball undone' });
});

module.exports = router;
