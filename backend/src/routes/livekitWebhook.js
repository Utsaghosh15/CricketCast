const { WebhookReceiver } = require('livekit-server-sdk');
const roomGuestDB = require('../db/roomGuestDB');
const { livekitRoomName } = require('../utils/livekitToken');

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

/**
 * Extract match UUID from room name `match-<uuid>`.
 * @param {string} roomName
 */
function matchIdFromRoom(roomName) {
  const m = /^match-([0-9a-f-]{36})$/i.exec(String(roomName || ''));
  return m ? m[1] : null;
}

/**
 * LiveKit Cloud webhook (use with express.raw body parser).
 * POST /api/livekit/webhook
 * @type {import('express').RequestHandler}
 */
async function handleLivekitWebhook(req, res) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_WEBHOOK_SECRET || process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !secret) {
      return err(res, 503, 'LIVEKIT_NOT_CONFIGURED', 'LiveKit webhook not configured');
    }

    const authHeader = req.get('Authorization') || req.get('Authorize') || '';
    const body = req.body;
    const raw = Buffer.isBuffer(body) ? body.toString('utf8') : typeof body === 'string' ? body : '';
    if (!raw) {
      return err(res, 400, 'BAD_BODY', 'Expected raw webhook body');
    }

    const receiver = new WebhookReceiver(apiKey, secret);
    const event = await receiver.receive(raw, authHeader);

    let roomName = '';
    let evType = '';
    let identity = '';
    try {
      const j = typeof event.toJson === 'function' ? event.toJson() : {};
      roomName = j.room?.name || j.room?.sid || '';
      evType = String(j.event ?? j.$type ?? '');
      identity = j.participant?.identity || j.participant?.sid || '';
    } catch (_) {
      roomName = event.room?.name || '';
      evType = String(event.event || '');
      identity = event.participant?.identity || '';
    }

    const matchId = matchIdFromRoom(roomName);
    if (matchId) {
      await roomGuestDB.logPresence(matchId, identity || 'unknown', evType || 'webhook', {
        room: roomName,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[livekit webhook]', e.message || e);
    return res.status(400).json({ error: 'Invalid webhook', code: 'WEBHOOK_VERIFY_FAILED' });
  }
}

module.exports = { handleLivekitWebhook };
