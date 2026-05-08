const express = require('express');
const { pool } = require('../db/pool');
const matchDB = require('../db/matchDB');
const ballDB = require('../db/ballDB');
const inningsEngine = require('../engine/inningsEngine');
const { getMatchState, formatScore } = require('../engine/scoreEngine');
const { buildOverlayData } = require('../engine/overlayEngine');
const { publish } = require('../redis/publisher');

const router = express.Router({ mergeParams: true });

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * End the current over after six legal deliveries.
 */
router.post('/over/end', async (req, res) => {
  const matchId = req.params.id;
  const { nextBowlerId } = req.body || {};
  if (!nextBowlerId) {
    return err(res, 400, 'VALIDATION', 'nextBowlerId is required');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inn = await matchDB.getCurrentInningsRow(client, matchId);
    if (!inn) {
      await client.query('ROLLBACK');
      return err(res, 400, 'INNINGS_NOT_FOUND', 'No active innings');
    }
    await inningsEngine.endOver(client, inn, nextBowlerId);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[over end]', e);
    if (e.code === 'OVER_NOT_COMPLETE') {
      return err(res, 400, e.code, 'Six legal balls required to end the over');
    }
    return err(res, 500, 'INTERNAL', 'Failed to end over');
  } finally {
    client.release();
  }

  const newState = await getMatchState(matchId);
  const inn = newState.innings;

  const innRow = await pool.query(
    `SELECT id FROM innings WHERE match_id = $1 AND innings_number = (
       SELECT current_innings FROM matches WHERE id = $1
     )`,
    [matchId]
  );
  const inningsId = innRow.rows[0]?.id;
  let overNumber = 1;
  let runsThisOver = 0;
  let wicketsThisOver = 0;
  if (inningsId) {
    const moRes = await pool.query(
      `SELECT MAX(over_number)::int AS m FROM balls WHERE innings_id = $1`,
      [inningsId]
    );
    overNumber = moRes.rows[0].m || 1;
    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(total_runs), 0)::int AS r,
        COALESCE(SUM(CASE WHEN type = 'WICKET' THEN 1 ELSE 0 END), 0)::int AS w
       FROM balls WHERE innings_id = $1 AND over_number = $2`,
      [inningsId, overNumber]
    );
    runsThisOver = sumRes.rows[0].r;
    wicketsThisOver = sumRes.rows[0].w;
  }

  const scoreShort = inn ? `${inn.runs}/${inn.wickets}` : '';
  const overlay = buildOverlayData('OVER_END', newState);
  overlay.overNumber = overNumber;
  overlay.runsThisOver = runsThisOver;
  overlay.wicketsThisOver = wicketsThisOver;
  overlay.score = scoreShort;

  const ev = {
    type: 'OVER_END',
    matchId,
    realWorldTime: Date.now(),
    payload: {
      overNumber,
      runsThisOver,
      wicketsThisOver,
      score: scoreShort,
      scoreFull: inn ? formatScore(inn.runs, inn.wickets, inn.overs, inn.balls) : '',
    },
  };

  try {
    await publish(`match:events:${matchId}`, ev);
    await pool.query(
      `INSERT INTO overlay_log (match_id, type, triggered_by, payload) VALUES ($1, $2, 'AUTO', $3::jsonb)`,
      [matchId, ev.type, JSON.stringify(ev)]
    );
    await publish(`match:overlays:${matchId}`, { type: 'OVER_END', payload: overlay, triggeredBy: 'AUTO' });
    await pool.query(
      `INSERT INTO overlay_log (match_id, type, triggered_by, payload) VALUES ($1, $2, 'AUTO', $3::jsonb)`,
      [matchId, 'OVER_END', JSON.stringify(overlay)]
    );
  } catch (e) {
    console.error('[over end publish]', e.message);
  }

  console.log('[over] end', matchId);
  return res.json({ data: newState, message: 'Over ended' });
});

/**
 * Set current bowler for the innings.
 */
router.post('/bowler', async (req, res) => {
  const matchId = req.params.id;
  const { bowlerId } = req.body || {};
  if (!bowlerId) {
    return err(res, 400, 'VALIDATION', 'bowlerId is required');
  }

  const client = await pool.connect();
  try {
    const inn = await matchDB.getCurrentInningsRow(client, matchId);
    if (!inn) {
      return err(res, 400, 'INNINGS_NOT_FOUND', 'No active innings');
    }
    await client.query(`UPDATE innings SET current_bowler_id = $2 WHERE id = $1`, [inn.id, bowlerId]);
    await client.query(
      `INSERT INTO bowling_cards (innings_id, player_id) VALUES ($1, $2)
       ON CONFLICT (innings_id, player_id) DO NOTHING`,
      [inn.id, bowlerId]
    );
  } catch (e) {
    console.error('[bowler]', e);
    return err(res, 500, 'INTERNAL', 'Failed to set bowler');
  } finally {
    client.release();
  }

  const newState = await getMatchState(matchId);
  console.log('[over] bowler set', matchId, bowlerId);
  return res.json({ data: newState, message: 'Bowler updated' });
});

module.exports = router;
