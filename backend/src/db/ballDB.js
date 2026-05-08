const { pool } = require('./pool');

/**
 * Fetch batting card for player in innings.
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 * @param {string} playerId
 */
async function getBattingCard(client, inningsId, playerId) {
  const r = await client.query(
    `SELECT * FROM batting_cards WHERE innings_id = $1 AND player_id = $2`,
    [inningsId, playerId]
  );
  return r.rows[0] || null;
}

/**
 * Fetch bowling card for player in innings.
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 * @param {string} playerId
 */
async function getBowlingCard(client, inningsId, playerId) {
  const r = await client.query(
    `SELECT * FROM bowling_cards WHERE innings_id = $1 AND player_id = $2`,
    [inningsId, playerId]
  );
  return r.rows[0] || null;
}

/**
 * Max delivery_number in innings.
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 */
async function getMaxDeliveryNumber(client, inningsId) {
  const r = await client.query(
    `SELECT COALESCE(MAX(delivery_number), 0) AS m FROM balls WHERE innings_id = $1`,
    [inningsId]
  );
  return Number(r.rows[0].m);
}

/**
 * Ordered balls for innings.
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 */
async function listBallsOrdered(client, inningsId) {
  const r = await client.query(
    `SELECT * FROM balls WHERE innings_id = $1 ORDER BY delivery_number ASC`,
    [inningsId]
  );
  return r.rows;
}

/**
 * Last ball row by delivery_number.
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 */
async function getLastBall(client, inningsId) {
  const r = await client.query(
    `SELECT * FROM balls WHERE innings_id = $1 ORDER BY delivery_number DESC LIMIT 1`,
    [inningsId]
  );
  return r.rows[0] || null;
}

/**
 * Balls in a specific over (by over_number).
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 * @param {number} overNumber
 */
async function listBallsInOver(client, inningsId, overNumber) {
  const r = await client.query(
    `SELECT * FROM balls WHERE innings_id = $1 AND over_number = $2 ORDER BY delivery_number ASC`,
    [inningsId, overNumber]
  );
  return r.rows;
}

/**
 * Count legal deliveries in an over.
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 * @param {number} overNumber
 */
async function countLegalBallsInOver(client, inningsId, overNumber) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS c FROM balls WHERE innings_id = $1 AND over_number = $2
     AND type IN ('RUN','BYE','LEG_BYE','WICKET')`,
    [inningsId, overNumber]
  );
  return r.rows[0].c;
}

/**
 * Delete ball by id.
 * @param {import('pg').PoolClient} client
 * @param {string} ballId
 */
async function deleteBallById(client, ballId) {
  await client.query(`DELETE FROM balls WHERE id = $1`, [ballId]);
}

/**
 * Reset all batting and bowling cards for innings (stats only).
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 */
async function resetBattingCardsStats(client, inningsId) {
  await client.query(
    `UPDATE batting_cards SET runs = 0, balls = 0, fours = 0, sixes = 0,
      how_out = NULL, bowler_id = NULL, fielder_id = NULL, status = 'DNB'
     WHERE innings_id = $1`,
    [inningsId]
  );
}

/**
 * Reset bowling cards stats for innings.
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 */
async function resetBowlingCardsStats(client, inningsId) {
  await client.query(
    `UPDATE bowling_cards SET overs = 0, balls = 0, maidens = 0, runs = 0, wickets = 0, wides = 0, no_balls = 0
     WHERE innings_id = $1`,
    [inningsId]
  );
}

/**
 * Delete all batting cards for innings.
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 */
async function deleteBattingCardsForInnings(client, inningsId) {
  await client.query(`DELETE FROM batting_cards WHERE innings_id = $1`, [inningsId]);
}

/**
 * Delete all bowling cards for innings.
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 */
async function deleteBowlingCardsForInnings(client, inningsId) {
  await client.query(`DELETE FROM bowling_cards WHERE innings_id = $1`, [inningsId]);
}

module.exports = {
  getBattingCard,
  getBowlingCard,
  getMaxDeliveryNumber,
  listBallsOrdered,
  getLastBall,
  listBallsInOver,
  countLegalBallsInOver,
  deleteBallById,
  resetBattingCardsStats,
  resetBowlingCardsStats,
  deleteBattingCardsForInnings,
  deleteBowlingCardsForInnings,
};
