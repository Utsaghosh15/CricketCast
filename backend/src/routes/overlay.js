const express = require('express');
const { pool } = require('../db/pool');
const matchDB = require('../db/matchDB');
const ballDB = require('../db/ballDB');
const playerDB = require('../db/playerDB');
const { getMatchState } = require('../engine/scoreEngine');
const { publish } = require('../redis/publisher');

const router = express.Router({ mergeParams: true });

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Publish manual overlay and persist log.
 * @param {string} matchId
 * @param {string} type
 * @param {object} payload
 */
async function publishManual(matchId, type, payload) {
  await pool.query(
    `INSERT INTO overlay_log (match_id, type, triggered_by, payload) VALUES ($1, $2, 'MANUAL', $3::jsonb)`,
    [matchId, type, JSON.stringify(payload)]
  );
  await publish(`match:overlays:${matchId}`, { type, payload, triggeredBy: 'MANUAL' });
  console.log('[overlay manual]', matchId, type);
}

/**
 * Manual overlay triggers.
 */
router.post('/overlay', async (req, res) => {
  const matchId = req.params.id;
  const { type, options = {} } = req.body || {};
  if (!type) {
    return err(res, 400, 'VALIDATION', 'type is required');
  }

  try {
    const state = await getMatchState(matchId);
    if (!state) return err(res, 404, 'NOT_FOUND', 'Match not found');

    const innRes = await pool.query(
      `SELECT * FROM innings WHERE match_id = $1 AND innings_number = $2`,
      [matchId, state.match.currentInnings]
    );
    const inn = innRes.rows[0];
    if (!inn && type !== 'UMPIRES_CARD' && type !== 'HIDE_ALL' && type !== 'CUSTOM_MESSAGE') {
      return err(res, 400, 'INNINGS_NOT_FOUND', 'No innings');
    }

    switch (type) {
      case 'BATTING_SCORECARD': {
        const cards = await pool.query(
          `SELECT bc.*, p.name AS player_name
           FROM batting_cards bc
           JOIN players p ON p.id = bc.player_id
           WHERE bc.innings_id = $1
           ORDER BY bc.created_at ASC`,
          [inn.id]
        );
        const payload = { cards: cards.rows };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      case 'BOWLING_FIGURES': {
        const cards = await pool.query(
          `SELECT bc.*, p.name AS player_name
           FROM bowling_cards bc
           JOIN players p ON p.id = bc.player_id
           WHERE bc.innings_id = $1
           ORDER BY bc.created_at ASC`,
          [inn.id]
        );
        const payload = { figures: cards.rows };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      case 'PLAYER_CARD_BATSMAN': {
        const target = options.target === 'nonStriker' ? 'nonStriker' : 'striker';
        const pid = target === 'striker' ? inn.striker_id : inn.non_striker_id;
        const card = await ballDB.getBattingCard(pool, inn.id, pid);
        const player = await playerDB.getPlayerById(pid, pool);
        const payload = { target, player, card };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      case 'PLAYER_CARD_BOWLER': {
        const pid = inn.current_bowler_id;
        const card = await ballDB.getBowlingCard(pool, inn.id, pid);
        const player = await playerDB.getPlayerById(pid, pool);
        const payload = { player, card };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      case 'TEAM_LINEUP': {
        const teamNum = options.team === 'team2' ? 2 : 1;
        const players = await playerDB.getPlayersByTeamNumber(matchId, teamNum, pool);
        const payload = { team: options.team || 'team1', players };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      case 'UMPIRES_CARD': {
        const umpires = await playerDB.getUmpiresByMatchId(matchId, pool);
        const payload = { officials: umpires };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      case 'PARTNERSHIP': {
        const w = await pool.query(
          `SELECT delivery_number FROM balls WHERE innings_id = $1 AND type = 'WICKET' ORDER BY delivery_number DESC LIMIT 1`,
          [inn.id]
        );
        const fromDel = w.rows[0] ? Number(w.rows[0].delivery_number) : 0;
        const p = await pool.query(
          `SELECT COALESCE(SUM(total_runs), 0)::int AS runs, COUNT(*)::int AS balls
           FROM balls WHERE innings_id = $1 AND delivery_number > $2`,
          [inn.id, fromDel]
        );
        const payload = {
          runs: p.rows[0].runs,
          balls: p.rows[0].balls,
          striker: state.batting?.striker,
          nonStriker: state.batting?.nonStriker,
        };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      case 'REQUIRED_RUNS': {
        if (Number(state.match.currentInnings) !== 2) {
          return err(res, 400, 'INVALID_INNINGS', 'Required runs overlay only valid in second innings');
        }
        const payload = {
          target: state.match.target,
          runs: state.innings?.runs,
          requiredRuns: state.requiredRuns,
          requiredBalls: state.requiredBalls,
          requiredRunRate: state.requiredRunRate,
        };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      case 'CUSTOM_MESSAGE': {
        const payload = { message: options.message || '', duration: options.duration || 5 };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      case 'HIDE_ALL': {
        const payload = { hide: true };
        await publishManual(matchId, type, payload);
        return res.json({ data: payload, message: 'Overlay published' });
      }
      default:
        return err(res, 400, 'UNKNOWN_TYPE', 'Unsupported overlay type');
    }
  } catch (e) {
    console.error('[overlay]', e);
    return err(res, 500, 'INTERNAL', 'Failed to process overlay');
  }
});

module.exports = router;
