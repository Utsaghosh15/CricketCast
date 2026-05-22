const crypto = require('crypto');
const express = require('express');
const { DataPacket_Kind } = require('livekit-server-sdk');
const roomGuestDB = require('../db/roomGuestDB');
const { verifyViewerToken } = require('../utils/viewerJwt');
const { livekitRoomName, mintLiveKitToken } = require('../utils/livekitToken');
const { getRoomServiceClient } = require('../utils/livekitRoomService');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router({ mergeParams: true });

const CHAT_MESSAGE_LK = 'CHAT_MESSAGE_LK';

function err(res, status, code, message) {
  return res.status(status).json({ error: message, code });
}

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

/**
 * Mint LiveKit token for scoring host (read-only in room; sees chat + remote tracks).
 * GET /api/match/:id/livekit/admin-token
 */
router.get('/livekit/admin-token', requireAdmin, async (req, res) => {
  try {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) {
      return err(res, 503, 'LIVEKIT_NOT_CONFIGURED', 'LiveKit is not configured on the server');
    }

    const matchId = req.params.id;
    const identity = `admin_${crypto.randomBytes(6).toString('hex')}`;
    const roomName = livekitRoomName(matchId);
    const { token, url: wsUrl, roomName: rm } = await mintLiveKitToken({
      apiKey,
      apiSecret,
      livekitUrl: url,
      roomName,
      identity,
      name: 'Host',
      canPublish: false,
    });

    return res.json({
      data: {
        token,
        url: wsUrl,
        roomName: rm,
        identity,
        canPublish: false,
      },
      message: 'OK',
    });
  } catch (e) {
    console.error('[livekit admin-token]', e);
    return err(res, 500, 'INTERNAL', 'Failed to mint token');
  }
});

/**
 * Broadcast chat to the match room via LiveKit server API (all subscribers receive it reliably).
 * POST /api/match/:id/livekit/room-chat
 * Body: { displayName, text?, emoji?, id? }
 */
router.post('/livekit/room-chat', async (req, res) => {
  try {
    const matchId = req.params.id;
    const svc = getRoomServiceClient();
    if (!svc) {
      return err(res, 503, 'LIVEKIT_NOT_CONFIGURED', 'LiveKit is not configured on the server');
    }

    const tok = bearer(req);
    const claims = verifyViewerToken(tok);
    if (!claims || claims.matchId !== matchId) {
      return err(res, 401, 'UNAUTHORIZED', 'Valid viewer session required');
    }

    const guest = await roomGuestDB.getGuestById(claims.guestId);
    if (!guest || guest.match_id !== matchId) {
      return err(res, 401, 'UNAUTHORIZED', 'Guest not found for this match');
    }

    const body = req.body || {};
    const displayName = String(body.displayName || '').trim().slice(0, 80);
    if (!displayName) {
      return err(res, 400, 'VALIDATION', 'displayName is required');
    }
    const text = body.text != null ? String(body.text).trim().slice(0, 500) : '';
    const emoji = body.emoji != null ? String(body.emoji).trim().slice(0, 16) : '';
    if (!text && !emoji) {
      return err(res, 400, 'VALIDATION', 'text or emoji is required');
    }
    const id = body.id ? String(body.id).slice(0, 120) : crypto.randomUUID();

    const roomName = livekitRoomName(matchId);
    const payload = {
      type: CHAT_MESSAGE_LK,
      id,
      displayName,
      text: text || null,
      emoji: emoji || null,
      ts: Date.now(),
      senderIdentity: `guest_${guest.id}`,
    };

    await svc.sendData(roomName, Buffer.from(JSON.stringify(payload), 'utf8'), DataPacket_Kind.RELIABLE, {});
    return res.json({ data: { ok: true, id }, message: 'OK' });
  } catch (e) {
    console.error('[livekit room-chat]', e);
    return err(res, 500, 'INTERNAL', e.message || 'Failed to broadcast chat');
  }
});

/**
 * Mint LiveKit access token for the logged-in room guest.
 * GET /api/match/:id/livekit/token
 */
router.get('/livekit/token', async (req, res) => {
  try {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) {
      return err(res, 503, 'LIVEKIT_NOT_CONFIGURED', 'LiveKit is not configured on the server');
    }

    const matchId = req.params.id;
    const tok = bearer(req);
    const claims = verifyViewerToken(tok);
    if (!claims || claims.matchId !== matchId) {
      return err(res, 401, 'UNAUTHORIZED', 'Valid viewer session required');
    }

    const guest = await roomGuestDB.getGuestById(claims.guestId);
    if (!guest || guest.match_id !== matchId) {
      return err(res, 401, 'UNAUTHORIZED', 'Guest not found for this match');
    }

    const rawPub = guest.can_publish;
    const canPublish =
      rawPub === true || rawPub === 't' || rawPub === 'true' || rawPub === 1 || rawPub === '1';

    const roomName = livekitRoomName(matchId);
    const identity = `guest_${guest.id}`;
    const { token, url: wsUrl, roomName: rm } = await mintLiveKitToken({
      apiKey,
      apiSecret,
      livekitUrl: url,
      roomName,
      identity,
      name: guest.display_name || guest.email,
      canPublish,
    });

    return res.json({
      data: {
        token,
        url: wsUrl,
        roomName: rm,
        identity,
        canPublish,
      },
      message: 'OK',
    });
  } catch (e) {
    console.error('[livekit token]', e);
    return err(res, 500, 'INTERNAL', 'Failed to mint token');
  }
});

module.exports = router;
