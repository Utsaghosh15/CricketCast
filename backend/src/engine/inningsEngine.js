const matchDB = require('../db/matchDB');
const ballDB = require('../db/ballDB');

/**
 * @param {string} type
 * @returns {boolean}
 */
function isLegalDelivery(type) {
  return type === 'RUN' || type === 'BYE' || type === 'LEG_BYE' || type === 'WICKET';
}

/**
 * Compute total runs for a delivery from normalized input.
 * @param {{ type: string, runsOffBat: number, extraRuns: number }} d
 * @returns {number}
 */
function computeTotalRuns(d) {
  const rob = Number(d.runsOffBat) || 0;
  const er = Number(d.extraRuns) || 0;
  switch (d.type) {
    case 'WIDE':
      return 1 + er;
    case 'NO_BALL':
      return 1 + rob + er;
    case 'RUN':
    case 'BYE':
    case 'LEG_BYE':
    case 'WICKET':
      return rob + er;
    default:
      return rob + er;
  }
}

/**
 * Whether odd runs swap striker/non-striker for this delivery type.
 * @param {string} type
 * @param {number} totalRuns
 */
function shouldRotateStrike(type, totalRuns) {
  if (type === 'WICKET') return false;
  return totalRuns % 2 === 1;
}

/**
 * Legal balls completed before this innings state (overs * 6 + balls in current over).
 * @param {{ overs: number, balls: number }} inn
 */
function legalBallsCompleted(inn) {
  return Number(inn.overs) * 6 + Number(inn.balls);
}

/**
 * Next over_number (1-based) and ball_number (1-6) for upcoming legal delivery.
 * @param {{ overs: number, balls: number }} inn
 */
function nextLegalSlot(inn) {
  const completed = legalBallsCompleted(inn);
  const overNumber = Math.floor(completed / 6) + 1;
  const ballNumber = (completed % 6) + 1;
  return { overNumber, ballNumber };
}

/**
 * Full replay of innings from all balls (after structural changes / undo).
 * @param {import('pg').PoolClient} client
 * @param {Record<string, unknown>} inningsRow
 */
async function replayInningsFromBalls(client, inningsRow) {
  const inningsId = inningsRow.id;
  const balls = await ballDB.listBallsOrdered(client, inningsId);

  await client.query(
    `UPDATE innings SET
      runs = 0, wickets = 0, overs = 0, balls = 0,
      extras_wide = 0, extras_noball = 0, extras_bye = 0, extras_legbye = 0,
      pending_over_end = false,
      striker_id = opening_striker_id,
      non_striker_id = opening_non_striker_id,
      current_bowler_id = opening_bowler_id
     WHERE id = $1`,
    [inningsId]
  );

  await client.query(
    `UPDATE batting_cards SET runs = 0, balls = 0, fours = 0, sixes = 0,
      how_out = NULL, bowler_id = NULL, fielder_id = NULL, status = 'DNB'
     WHERE innings_id = $1`,
    [inningsId]
  );
  await client.query(
    `UPDATE bowling_cards SET overs = 0, balls = 0, maidens = 0, runs = 0, wickets = 0, wides = 0, no_balls = 0
     WHERE innings_id = $1`,
    [inningsId]
  );

  const fresh = await matchDB.getInningsById(client, inningsId);
  const openingStriker = fresh.striker_id;
  const openingNon = fresh.non_striker_id;
  const openingBowler = fresh.current_bowler_id;

  await client.query(
    `UPDATE batting_cards SET status = 'BATTING' WHERE innings_id = $1 AND player_id IN ($2, $3)`,
    [inningsId, openingStriker, openingNon]
  );
  await client.query(
    `INSERT INTO bowling_cards (innings_id, player_id) VALUES ($1, $2)
     ON CONFLICT (innings_id, player_id) DO NOTHING`,
    [inningsId, openingBowler]
  );

  let state = await matchDB.getInningsById(client, inningsId);

  for (const b of balls) {
    state = await applyStoredBall(client, state, b);
  }
  return state;
}

/**
 * Apply effects of an existing ball row during replay.
 * @param {import('pg').PoolClient} client
 * @param {Record<string, unknown>} inningsRow
 * @param {Record<string, unknown>} ballRow
 */
async function applyStoredBall(client, inningsRow, ballRow) {
  const payload = {
    type: ballRow.type,
    runsOffBat: Number(ballRow.runs_off_bat) || 0,
    extraRuns: Number(ballRow.extra_runs) || 0,
    totalRuns: Number(ballRow.total_runs) || 0,
    dismissalType: ballRow.dismissal_type,
    dismissedPlayerId: ballRow.dismissed_player_id,
    fielderId: ballRow.fielder_id,
    newBatsmanId: ballRow.new_batsman_id,
  };
  return applyDelivery(client, inningsRow, payload, {
    persist: false,
    existingBall: ballRow,
  });
}

/**
 * Record a new ball and mutate DB state.
 * @param {import('pg').PoolClient} client
 * @param {Record<string, unknown>} inningsRow
 * @param {object} body Normalized delivery body
 */
async function recordNewBall(client, inningsRow, body) {
  return applyDelivery(client, inningsRow, body, { persist: true });
}

/**
 * Core delivery application (insert optional).
 * @param {import('pg').PoolClient} client
 * @param {Record<string, unknown>} inningsRow
 * @param {object} body
 * @param {{ persist: boolean, existingBall?: Record<string, unknown>, matchId?: string }} opts
 */
async function applyDelivery(client, inningsRow, body, opts) {
  const inningsId = inningsRow.id;
  let inn = { ...inningsRow };

  if (inn.pending_over_end && opts.persist) {
    const err = new Error('OVER_PENDING_END');
    err.code = 'OVER_PENDING_END';
    throw err;
  }

  const strikerId = inn.striker_id;
  const nonStrikerId = inn.non_striker_id;
  const bowlerId = inn.current_bowler_id;

  const totalRuns = body.totalRuns != null ? Number(body.totalRuns) : computeTotalRuns(body);
  const type = body.type;

  if (type === 'WICKET' && !body.newBatsmanId && opts.persist) {
    const err = new Error('NEW_BATSMAN_REQUIRED');
    err.code = 'NEW_BATSMAN_REQUIRED';
    throw err;
  }

  const maxDel = await ballDB.getMaxDeliveryNumber(client, inningsId);
  const deliveryNumber = opts.persist ? maxDel + 1 : Number(opts.existingBall?.delivery_number);

  let overNumber;
  let ballNumber;
  if (opts.persist) {
    const slot = nextLegalSlot({
      overs: Number(inn.overs),
      balls: Number(inn.balls),
    });
    overNumber = slot.overNumber;
    ballNumber = slot.ballNumber;
  } else {
    overNumber = opts.existingBall.over_number;
    ballNumber = opts.existingBall.ball_number;
  }

  const batsmanIdForCard = strikerId;

  if (opts.persist) {
    const ins = await client.query(
      `INSERT INTO balls (
        innings_id, over_number, ball_number, delivery_number, type,
        runs_off_bat, extra_runs, total_runs,
        batsman_id, bowler_id, fielder_id, dismissal_type, dismissed_player_id, new_batsman_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        inningsId,
        overNumber,
        ballNumber,
        deliveryNumber,
        type,
        Number(body.runsOffBat) || 0,
        Number(body.extraRuns) || 0,
        totalRuns,
        strikerId,
        bowlerId,
        body.fielderId || null,
        body.dismissalType || null,
        body.dismissedPlayerId || null,
        body.newBatsmanId || null,
      ]
    );
    opts.existingBall = ins.rows[0];
  }

  await client.query(
    `UPDATE innings SET
      runs = runs + $2::int,
      extras_wide = extras_wide + $3::int,
      extras_noball = extras_noball + $4::int,
      extras_bye = extras_bye + $5::int,
      extras_legbye = extras_legbye + $6::int,
      wickets = wickets + $7::int
     WHERE id = $1`,
    [
      inningsId,
      totalRuns,
      type === 'WIDE' ? totalRuns : 0,
      type === 'NO_BALL' ? 1 : 0,
      type === 'BYE' ? totalRuns : 0,
      type === 'LEG_BYE' ? totalRuns : 0,
      type === 'WICKET' ? 1 : 0,
    ]
  );

  const legal = isLegalDelivery(type);
  let newOvers = Number(inn.overs);
  let newBallsInOver = Number(inn.balls);
  let pending = false;

  if (legal) {
    const completedBefore = legalBallsCompleted({
      overs: Number(inn.overs),
      balls: Number(inn.balls),
    });
    const completedAfter = completedBefore + 1;
    newOvers = Math.floor(completedAfter / 6);
    newBallsInOver = completedAfter % 6;
    if (completedAfter % 6 === 0) {
      pending = true;
    }
  }

  await client.query(
    `UPDATE innings SET overs = $2, balls = $3, pending_over_end = $4 WHERE id = $1`,
    [inningsId, newOvers, newBallsInOver, pending]
  );

  const bc = await ballDB.getBattingCard(client, inningsId, batsmanIdForCard);
  if (bc) {
    let addRuns = 0;
    let addBalls = 0;
    let add4 = 0;
    let add6 = 0;
    if (type === 'RUN') {
      addRuns = Number(body.runsOffBat) || 0;
      addBalls = 1;
      if (addRuns === 4) add4 = 1;
      if (addRuns === 6) add6 = 1;
    } else if (type === 'NO_BALL') {
      addRuns = (Number(body.runsOffBat) || 0) + (Number(body.extraRuns) || 0);
      addBalls = 0;
    } else if (type === 'WIDE') {
      addRuns = 0;
      addBalls = 0;
    } else if (type === 'BYE' || type === 'LEG_BYE') {
      addRuns = 0;
      addBalls = 1;
    } else if (type === 'WICKET') {
      addRuns = Number(body.runsOffBat) || 0;
      addBalls = 1;
    }

    await client.query(
      `UPDATE batting_cards SET
        runs = runs + $2, balls = balls + $3, fours = fours + $4, sixes = sixes + $5
       WHERE id = $1`,
      [bc.id, addRuns, addBalls, add4, add6]
    );
  }

  const bw = await ballDB.getBowlingCard(client, inningsId, bowlerId);
  if (bw) {
    let runsConceded = totalRuns;
    let wk = type === 'WICKET' ? 1 : 0;
    let wides = type === 'WIDE' ? 1 : 0;
    let nbs = type === 'NO_BALL' ? 1 : 0;
    let legalBallsBowled = 0;
    if (legal) legalBallsBowled = 1;

    await client.query(
      `UPDATE bowling_cards SET
        runs = runs + $2,
        wickets = wickets + $3,
        wides = wides + $4,
        no_balls = no_balls + $5,
        balls = balls + $6
       WHERE id = $1`,
      [bw.id, runsConceded, wk, wides, nbs, legalBallsBowled]
    );

    const bw2 = await ballDB.getBowlingCard(client, inningsId, bowlerId);
    const totalBowlingBalls = Number(bw2.balls);
    const completedOvers = Math.floor(totalBowlingBalls / 6);
    const rem = totalBowlingBalls % 6;
    await client.query(
      `UPDATE bowling_cards SET overs = $2, balls = $3 WHERE id = $1`,
      [bw2.id, completedOvers, rem]
    );
  }

  let nextStriker = strikerId;
  let nextNon = nonStrikerId;

  if (type === 'WICKET') {
    const dismissed = body.dismissedPlayerId;
    const newB = body.newBatsmanId;
    await client.query(
      `UPDATE batting_cards SET status = 'OUT', how_out = $3, bowler_id = $4, fielder_id = $5
       WHERE innings_id = $1 AND player_id = $2`,
      [
        inningsId,
        dismissed,
        body.dismissalType || 'WICKET',
        bowlerId,
        body.fielderId || null,
      ]
    );
    if (String(dismissed) === String(strikerId)) {
      nextStriker = newB;
      nextNon = nonStrikerId;
    } else {
      nextStriker = strikerId;
      nextNon = newB;
    }
    if (newB) {
      await client.query(
        `INSERT INTO batting_cards (innings_id, player_id, status) VALUES ($1, $2, 'BATTING')
         ON CONFLICT (innings_id, player_id) DO UPDATE SET status = 'BATTING'`,
        [inningsId, newB]
      );
    }
  } else if (shouldRotateStrike(type, totalRuns)) {
    nextStriker = nonStrikerId;
    nextNon = strikerId;
  }

  await client.query(
    `UPDATE innings SET striker_id = $2, non_striker_id = $3 WHERE id = $1`,
    [inningsId, nextStriker, nextNon]
  );

  if (opts.existingBall) {
    await client.query(
      `UPDATE balls SET post_striker_id = $2, post_non_striker_id = $3 WHERE id = $1`,
      [opts.existingBall.id, nextStriker, nextNon]
    );
  }

  return matchDB.getInningsById(client, inningsId);
}

/**
 * Undo last ball for current innings: delete row and replay.
 * @param {import('pg').PoolClient} client
 * @param {string} matchId
 */
async function undoLastBall(client, matchId) {
  const innRow = await matchDB.getCurrentInningsRow(client, matchId);
  if (!innRow) {
    const err = new Error('INNINGS_NOT_FOUND');
    err.code = 'INNINGS_NOT_FOUND';
    throw err;
  }
  const last = await ballDB.getLastBall(client, innRow.id);
  if (!last) {
    const err = new Error('NO_BALL_TO_UNDO');
    err.code = 'NO_BALL_TO_UNDO';
    throw err;
  }
  await ballDB.deleteBallById(client, last.id);
  return replayInningsFromBalls(client, innRow);
}

/**
 * End current over: rotate strike, assign next bowler, clear pending flag.
 * @param {import('pg').PoolClient} client
 * @param {Record<string, unknown>} inningsRow
 * @param {string} nextBowlerId
 */
async function endOver(client, inningsRow, nextBowlerId) {
  const inningsId = inningsRow.id;
  const lastOverNum = await client.query(
    `SELECT MAX(over_number)::int AS m FROM balls WHERE innings_id = $1`,
    [inningsId]
  );
  const maxOver = lastOverNum.rows[0].m;
  if (!maxOver) {
    const err = new Error('OVER_NOT_COMPLETE');
    err.code = 'OVER_NOT_COMPLETE';
    throw err;
  }
  const legalCount = await ballDB.countLegalBallsInOver(client, inningsId, maxOver);

  if (legalCount < 6) {
    const err = new Error('OVER_NOT_COMPLETE');
    err.code = 'OVER_NOT_COMPLETE';
    throw err;
  }

  const striker = inningsRow.striker_id;
  const non = inningsRow.non_striker_id;

  await client.query(
    `UPDATE innings SET
      pending_over_end = false,
      striker_id = $2,
      non_striker_id = $3,
      current_bowler_id = $4
     WHERE id = $1`,
    [inningsId, non, striker, nextBowlerId]
  );

  await client.query(
    `INSERT INTO bowling_cards (innings_id, player_id) VALUES ($1, $2)
     ON CONFLICT (innings_id, player_id) DO NOTHING`,
    [inningsId, nextBowlerId]
  );

  return matchDB.getInningsById(client, inningsId);
}

module.exports = {
  isLegalDelivery,
  computeTotalRuns,
  recordNewBall,
  replayInningsFromBalls,
  undoLastBall,
  endOver,
  nextLegalSlot,
};
