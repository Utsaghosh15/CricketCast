const { pool } = require('./pool');
const crypto = require('crypto');

/**
 * @param {import('pg').PoolClient} client
 * @param {string} matchId
 * @returns {Promise<Record<string, unknown>|null>}
 */
async function getMatchRow(client, matchId) {
  const r = await client.query(`SELECT * FROM matches WHERE id = $1`, [matchId]);
  return r.rows[0] || null;
}

/**
 * Current active innings for a match (by match.current_innings).
 * @param {import('pg').PoolClient} client
 * @param {string} matchId
 * @returns {Promise<Record<string, unknown>|null>}
 */
async function getCurrentInningsRow(client, matchId) {
  const m = await getMatchRow(client, matchId);
  if (!m) return null;
  const r = await client.query(
    `SELECT * FROM innings WHERE match_id = $1 AND innings_number = $2`,
    [matchId, m.current_innings]
  );
  return r.rows[0] || null;
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} inningsId
 */
async function getInningsById(client, inningsId) {
  const r = await client.query(`SELECT * FROM innings WHERE id = $1`, [inningsId]);
  return r.rows[0] || null;
}

/**
 * Update match stream fields.
 * @param {string} matchId
 * @param {{ streamUrl?: string, streamKey?: string }} fields
 */
async function updateMatchStream(matchId, fields, client = pool) {
  const { streamUrl, streamKey } = fields;
  const r = await client.query(
    `UPDATE matches SET stream_url = COALESCE($2, stream_url), stream_key = COALESCE($3, stream_key)
     WHERE id = $1 RETURNING *`,
    [matchId, streamUrl ?? null, streamKey ?? null]
  );
  return r.rows[0] || null;
}

/**
 * Set match status and optional fields.
 * @param {string} matchId
 * @param {string} status
 * @param {Record<string, unknown>} [extra]
 */
async function setMatchStatus(matchId, status, extra = {}, client = pool) {
  const r = await client.query(
    `UPDATE matches SET
      status = $2,
      target = COALESCE($3, target),
      result_text = COALESCE($4, result_text),
      man_of_match_id = COALESCE($5, man_of_match_id)
     WHERE id = $1 RETURNING *`,
    [matchId, status, extra.target ?? null, extra.result_text ?? null, extra.man_of_match_id ?? null]
  );
  return r.rows[0] || null;
}

/**
 * List matches with LIVE status.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function listLiveMatches(client = pool) {
  const r = await client.query(
    `SELECT * FROM matches WHERE status = 'LIVE' ORDER BY match_date DESC, created_at DESC`
  );
  return r.rows;
}

/**
 * Live + completed matches for the home page API.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function listMatchesForHome(client = pool) {
  const r = await client.query(
    `SELECT * FROM matches WHERE status IN ('LIVE', 'COMPLETE') ORDER BY match_date DESC, created_at DESC`
  );
  return r.rows;
}

/**
 * Resolve batting and bowling team ids from toss.
 * @param {string} tossWinner "team1"|"team2"
 * @param {string} tossElected "bat"|"bowl"
 * @param {string} team1Id
 * @param {string} team2Id
 * @returns {{ battingTeamId: string, bowlingTeamId: string }}
 */
function resolveTeamsFromToss(tossWinner, tossElected, team1Id, team2Id) {
  const team1Bats =
    (tossWinner === 'team1' && tossElected === 'bat') ||
    (tossWinner === 'team2' && tossElected === 'bowl');
  const battingTeamId = team1Bats ? team1Id : team2Id;
  const bowlingTeamId = team1Bats ? team2Id : team1Id;
  return { battingTeamId, bowlingTeamId };
}

/**
 * Create full match graph in one transaction.
 * @param {object} body Request body (camelCase normalized by route)
 * @returns {Promise<string>} match id
 */
async function createMatchFull(body) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      title,
      format,
      totalOvers,
      venue,
      date,
      toss,
      team1,
      team2,
      umpires,
      opening,
    } = body;

    const mRes = await client.query(
      `INSERT INTO matches (title, format, total_overs, venue, match_date, status, toss_winner, toss_elected)
       VALUES ($1, $2, $3, $4, $5, 'TOSS', $6, $7) RETURNING id`,
      [title, format, totalOvers ?? null, venue ?? null, date, toss.winner, toss.elected]
    );
    const matchId = mRes.rows[0].id;

    const t1 = await client.query(
      `INSERT INTO teams (match_id, team_number, name) VALUES ($1, 1, $2) RETURNING id`,
      [matchId, team1.name]
    );
    const t2 = await client.query(
      `INSERT INTO teams (match_id, team_number, name) VALUES ($1, 2, $2) RETURNING id`,
      [matchId, team2.name]
    );
    const team1Id = t1.rows[0].id;
    const team2Id = t2.rows[0].id;

    const { battingTeamId, bowlingTeamId } = resolveTeamsFromToss(
      toss.winner,
      toss.elected,
      team1Id,
      team2Id
    );

    const playerIdByKey = new Map();

    async function insertPlayers(teamId, players, teamNum) {
      let idx = 0;
      for (const p of players) {
        const pid = p.id && /^[0-9a-f-]{36}$/i.test(p.id) ? p.id : crypto.randomUUID();
        const order = p.battingOrder != null ? p.battingOrder : idx + 1;
        idx += 1;
        await client.query(
          `INSERT INTO players (id, match_id, team_id, name, jersey_number, role, batting_order, is_captain, is_wicketkeeper)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            pid,
            matchId,
            teamId,
            p.name,
            p.jerseyNumber ?? null,
            p.role ?? null,
            order,
            !!p.isCaptain,
            !!p.isWicketkeeper,
          ]
        );
        playerIdByKey.set(`${teamNum}:${order}`, pid);
        playerIdByKey.set(pid, pid);
        if (p.id && /^[0-9a-f-]{36}$/i.test(p.id)) playerIdByKey.set(p.id, pid);
      }
    }

    await insertPlayers(team1Id, team1.players || [], 1);
    await insertPlayers(team2Id, team2.players || [], 2);

    for (const u of umpires || []) {
      await client.query(
        `INSERT INTO umpires (match_id, name, role) VALUES ($1, $2, $3)`,
        [matchId, u.name, u.role]
      );
    }

    const inn = await client.query(
      `INSERT INTO innings (match_id, innings_number, batting_team_id, bowling_team_id)
       VALUES ($1, 1, $2, $3) RETURNING id`,
      [matchId, battingTeamId, bowlingTeamId]
    );
    const inningsId = inn.rows[0].id;

    const battingTeamNum = battingTeamId === team1Id ? 1 : 2;
    const bowlingTeamNum = bowlingTeamId === team1Id ? 1 : 2;

    let strikerId = opening?.strikerId || null;
    let nonStrikerId = opening?.nonStrikerId || opening?.non_strikerId || null;
    let bowlerId = opening?.bowlerId || null;

    const resolvePid = (id) => (id ? playerIdByKey.get(id) || id : null);
    strikerId = resolvePid(strikerId);
    nonStrikerId = resolvePid(nonStrikerId);
    bowlerId = resolvePid(bowlerId);

    if (!strikerId && opening?.strikerBattingOrder != null) {
      strikerId = playerIdByKey.get(`${battingTeamNum}:${opening.strikerBattingOrder}`);
    }
    if (!nonStrikerId && opening?.nonStrikerBattingOrder != null) {
      nonStrikerId = playerIdByKey.get(`${battingTeamNum}:${opening.nonStrikerBattingOrder}`);
    }
    if (!bowlerId && opening?.bowlerBattingOrder != null) {
      bowlerId = playerIdByKey.get(`${bowlingTeamNum}:${opening.bowlerBattingOrder}`);
    }

    if (!strikerId || !nonStrikerId || !bowlerId) {
      throw new Error('OPENING_PLAYERS_REQUIRED');
    }

    await client.query(
      `UPDATE innings SET
        striker_id = $2, non_striker_id = $3, current_bowler_id = $4,
        opening_striker_id = $2, opening_non_striker_id = $3, opening_bowler_id = $4
       WHERE id = $1`,
      [inningsId, strikerId, nonStrikerId, bowlerId]
    );

    for (const pid of [strikerId, nonStrikerId]) {
      await client.query(
        `INSERT INTO batting_cards (innings_id, player_id, status) VALUES ($1, $2, 'BATTING')
         ON CONFLICT (innings_id, player_id) DO NOTHING`,
        [inningsId, pid]
      );
    }

    await client.query(
      `INSERT INTO bowling_cards (innings_id, player_id) VALUES ($1, $2)
       ON CONFLICT (innings_id, player_id) DO NOTHING`,
      [inningsId, bowlerId]
    );

    await client.query('COMMIT');
    return matchId;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  getMatchRow,
  getCurrentInningsRow,
  getInningsById,
  updateMatchStream,
  setMatchStatus,
  listLiveMatches,
  listMatchesForHome,
  createMatchFull,
  resolveTeamsFromToss,
};
