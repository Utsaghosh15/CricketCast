const { pool } = require('./pool');

/**
 * Fetch all teams for a match ordered by team_number.
 * @param {import('pg').PoolClient} [client]
 * @param {string} matchId
 * @returns {Promise<Array<{ id: string, match_id: string, team_number: number, name: string }>>}
 */
async function getTeamsByMatchId(matchId, client = pool) {
  const r = await client.query(
    `SELECT id, match_id, team_number, name FROM teams WHERE match_id = $1 ORDER BY team_number`,
    [matchId]
  );
  return r.rows;
}

/**
 * Fetch all players for a match with team_number.
 * @param {string} matchId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function getPlayersWithTeams(matchId, client = pool) {
  const r = await client.query(
    `SELECT p.*, t.team_number
     FROM players p
     JOIN teams t ON t.id = p.team_id
     WHERE p.match_id = $1
     ORDER BY t.team_number, p.batting_order NULLS LAST, p.name`,
    [matchId]
  );
  return r.rows;
}

/**
 * Fetch players for a specific team by team_number (1 or 2).
 * @param {string} matchId
 * @param {number} teamNumber
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function getPlayersByTeamNumber(matchId, teamNumber, client = pool) {
  const r = await client.query(
    `SELECT p.* FROM players p
     JOIN teams t ON t.id = p.team_id
     WHERE p.match_id = $1 AND t.team_number = $2
     ORDER BY p.batting_order NULLS LAST, p.name`,
    [matchId, teamNumber]
  );
  return r.rows;
}

/**
 * Fetch all umpires for a match.
 * @param {string} matchId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function getUmpiresByMatchId(matchId, client = pool) {
  const r = await client.query(
    `SELECT * FROM umpires WHERE match_id = $1 ORDER BY role`,
    [matchId]
  );
  return r.rows;
}

/**
 * Load a single player by id.
 * @param {string} playerId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<Record<string, unknown>|null>}
 */
async function getPlayerById(playerId, client = pool) {
  const r = await client.query(`SELECT * FROM players WHERE id = $1`, [playerId]);
  return r.rows[0] || null;
}

module.exports = {
  getTeamsByMatchId,
  getPlayersWithTeams,
  getPlayersByTeamNumber,
  getUmpiresByMatchId,
  getPlayerById,
};
