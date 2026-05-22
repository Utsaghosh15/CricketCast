const { pool } = require('./pool');

/**
 * Normalize email for storage / lookup.
 * @param {string} email
 */
function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * @param {string} matchId
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findGuestByEmail(matchId, email) {
  const e = normEmail(email);
  const r = await pool.query(
    `SELECT * FROM match_room_guests WHERE match_id = $1 AND lower(trim(email)) = $2`,
    [matchId, e]
  );
  return r.rows[0] || null;
}

/**
 * @param {string} guestId
 * @returns {Promise<object|null>}
 */
async function getGuestById(guestId) {
  const r = await pool.query(`SELECT * FROM match_room_guests WHERE id = $1`, [guestId]);
  return r.rows[0] || null;
}

/**
 * @param {string} matchId
 * @returns {Promise<object[]>}
 */
async function listGuestsByMatch(matchId) {
  const r = await pool.query(
    `SELECT id, match_id, email, display_name, can_publish, created_at FROM match_room_guests WHERE match_id = $1 ORDER BY created_at ASC`,
    [matchId]
  );
  return r.rows;
}

/**
 * @param {string} matchId
 * @param {Array<{ email: string, displayName?: string }>} entries
 * @returns {Promise<Array<{ id: string, email: string, tempPassword: string }>>}
 */
async function bulkCreateGuests(matchId, entries) {
  const bcrypt = require('bcrypt');
  const out = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of entries) {
      const email = normEmail(row.email);
      if (!email || !email.includes('@')) continue;
      const plain = require('crypto').randomBytes(5).toString('base64url').slice(0, 10);
      const hash = await bcrypt.hash(plain, 10);
      const dn = (row.displayName && String(row.displayName).trim().slice(0, 80)) || null;
      const ins = await client.query(
        `INSERT INTO match_room_guests (match_id, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (match_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash, display_name = COALESCE(EXCLUDED.display_name, match_room_guests.display_name)
         RETURNING id, email`,
        [matchId, email, hash, dn]
      );
      if (ins.rows[0]) {
        out.push({ id: ins.rows[0].id, email: ins.rows[0].email, tempPassword: plain });
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return out;
}

/**
 * @param {string} guestId
 * @param {boolean} canPublish
 */
async function setGuestCanPublish(guestId, canPublish) {
  const r = await pool.query(
    `UPDATE match_room_guests SET can_publish = $2 WHERE id = $1 RETURNING *`,
    [guestId, !!canPublish]
  );
  return r.rows[0] || null;
}

/**
 * @param {string} matchId
 * @param {string} participantIdentity
 * @param {string} eventType
 * @param {object|null} payload
 */
async function logPresence(matchId, participantIdentity, eventType, payload) {
  await pool.query(
    `INSERT INTO livekit_presence_log (match_id, participant_identity, event_type, payload) VALUES ($1, $2, $3, $4::jsonb)`,
    [matchId, participantIdentity, eventType, JSON.stringify(payload || {})]
  );
}

/**
 * Recent presence events for admin UI.
 * @param {string} matchId
 * @param {number} limit
 */
async function listRecentPresence(matchId, limit = 50) {
  const r = await pool.query(
    `SELECT * FROM livekit_presence_log WHERE match_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [matchId, limit]
  );
  return r.rows;
}

module.exports = {
  normEmail,
  findGuestByEmail,
  getGuestById,
  listGuestsByMatch,
  bulkCreateGuests,
  setGuestCanPublish,
  logPresence,
  listRecentPresence,
};
