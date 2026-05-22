const express = require('express');
const { pool } = require('../db/pool');
const roomGuestDB = require('../db/roomGuestDB');
const { sendMatchInviteEmail } = require('../utils/inviteEmail');
const { requireAdmin } = require('../middleware/requireAdmin');
const { getRoomServiceClient } = require('../utils/livekitRoomService');
const { livekitRoomName } = require('../utils/livekitToken');

const router = express.Router({ mergeParams: true });

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * List invited guests + recent LiveKit presence (admin).
 * GET /api/match/:id/room-guests
 */
router.get('/room-guests', requireAdmin, async (req, res) => {
  try {
    const matchId = req.params.id;
    let guests = [];
    let presence = [];
    try {
      guests = await roomGuestDB.listGuestsByMatch(matchId);
    } catch (e) {
      if (e.code !== '42P01') throw e;
    }
    try {
      presence = await roomGuestDB.listRecentPresence(matchId, 40);
    } catch (e) {
      if (e.code !== '42P01') throw e;
    }
    return res.json({ data: { guests, presence }, message: 'OK' });
  } catch (e) {
    console.error('[room-guests list]', e);
    return err(res, 500, 'INTERNAL', 'Failed to list guests');
  }
});

/**
 * Invite or reset passwords for emails (returns temp passwords once).
 * POST /api/match/:id/room-guests
 * Body: { emails: string[], displayNames?: Record<email, string> }
 */
router.post('/room-guests', requireAdmin, async (req, res) => {
  try {
    const matchId = req.params.id;
    const { emails, displayNames } = req.body || {};
    if (!Array.isArray(emails) || emails.length === 0) {
      return err(res, 400, 'VALIDATION', 'emails array is required');
    }
    const entries = emails.map((email) => ({
      email: String(email),
      displayName: displayNames && displayNames[email] ? displayNames[email] : undefined,
    }));
    const created = await roomGuestDB.bulkCreateGuests(matchId, entries);
    let matchTitle = 'CricCast match';
    try {
      const tr = await pool.query(`SELECT title FROM matches WHERE id = $1`, [matchId]);
      if (tr.rows[0]?.title) matchTitle = String(tr.rows[0].title);
    } catch (_) {}
    for (const row of created) {
      void sendMatchInviteEmail({
        to: row.email,
        tempPassword: row.tempPassword,
        matchTitle,
        matchId,
      }).catch((e) => console.error('[invite email]', row.email, e.message || e));
    }
    return res.status(201).json({
      data: { invited: created },
      message: 'Guests invited — share tempPassword with each email (shown once). If SMTP is configured, invites are emailed automatically.',
    });
  } catch (e) {
    console.error('[room-guests create]', e);
    if (e.code === '42P01') {
      return err(
        res,
        503,
        'MIGRATION_REQUIRED',
        'Database tables missing — run: psql $DATABASE_URL -f src/db/migrations/002_match_room_guests.sql'
      );
    }
    return err(res, 500, 'INTERNAL', 'Failed to create guests');
  }
});

/**
 * Allow / revoke fan camera publish for a guest (LiveKit permissions updated live; token refresh on reconnect).
 * PATCH /api/match/:id/room-guests/:guestId
 * Body: { canPublish: boolean }
 */
router.patch('/room-guests/:guestId', requireAdmin, async (req, res) => {
  try {
    const { guestId } = req.params;
    const { canPublish } = req.body || {};
    if (typeof canPublish !== 'boolean') {
      return err(res, 400, 'VALIDATION', 'canPublish boolean is required');
    }
    const row = await roomGuestDB.setGuestCanPublish(guestId, canPublish);
    if (!row || row.match_id !== req.params.id) {
      return err(res, 404, 'NOT_FOUND', 'Guest not found');
    }

    const svc = getRoomServiceClient();
    if (svc) {
      const roomName = livekitRoomName(req.params.id);
      const identity = `guest_${guestId}`;
      try {
        await svc.updateParticipant(roomName, identity, {
          permission: {
            canSubscribe: true,
            canPublish,
            canPublishData: true,
          },
        });
      } catch (e) {
        console.warn('[room-guests] LiveKit updateParticipant', e.message || e);
      }
    }

    return res.json({
      data: row,
      message: 'Updated — LiveKit permissions synced when the guest is in the room.',
    });
  } catch (e) {
    console.error('[room-guests patch]', e);
    return err(res, 500, 'INTERNAL', 'Failed to update guest');
  }
});

module.exports = router;
