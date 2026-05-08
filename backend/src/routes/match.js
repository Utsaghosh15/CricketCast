const express = require('express');
const matchDB = require('../db/matchDB');
const { getMatchState } = require('../engine/scoreEngine');
const { sendDbAwareError } = require('../utils/dbHttpError');

const router = express.Router();

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Create match with squads, umpires, and first innings.
 */
router.post('/create', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !b.format || !b.date || !b.toss || !b.team1 || !b.team2) {
      return err(res, 400, 'VALIDATION', 'title, format, date, toss, team1, team2 are required');
    }
    const body = {
      title: b.title,
      format: b.format,
      totalOvers: b.totalOvers,
      venue: b.venue,
      date: b.date,
      toss: b.toss,
      team1: b.team1,
      team2: b.team2,
      umpires: b.umpires || [],
      opening: b.opening || {
        strikerBattingOrder: 1,
        nonStrikerBattingOrder: 2,
        bowlerBattingOrder: 1,
      },
    };
    const matchId = await matchDB.createMatchFull(body);
    const state = await getMatchState(matchId);
    console.log('[match] created', matchId);
    return res.status(201).json({ data: state, message: 'Match created' });
  } catch (e) {
    if (e.message === 'OPENING_PLAYERS_REQUIRED') {
      return err(res, 400, 'OPENING_PLAYERS_REQUIRED', 'opening batsmen and bowler could not be resolved');
    }
    return sendDbAwareError(res, e, '[match create]', 'Failed to create match');
  }
});

module.exports = router;
