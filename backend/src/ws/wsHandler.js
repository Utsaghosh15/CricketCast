const { randomUUID } = require('crypto');
const { WebSocket } = require('ws');
const { getMatchState } = require('../engine/scoreEngine');
const { publish } = require('../redis/publisher');
const { createChatDataChannelRelay } = require('./chatDataChannelRelay');
const { verifyViewerToken } = require('../utils/viewerJwt');
const { verifyAdminToken } = require('../utils/adminJwt');
const { redactMatchState, redactFanoutEnvelope } = require('../utils/redactMatchStreams');

/** @typedef {{ ws: import('ws'), matchId: string, role: string, lastPong: number, streamAllowed: boolean }} ClientMeta */

/**
 * Create WebSocket handler state and helpers.
 * @param {Map<string, Set<import('ws')>>} subscriptions
 */
function createWsHandler(subscriptions) {
  /** @type {Map<import('ws'), ClientMeta>} */
  const meta = new Map();

  const chatRelay = createChatDataChannelRelay({
    publish,
    getMatchId: (ws) => meta.get(ws)?.matchId || '',
    socketsForMatch: (id) => subscriptions.get(id),
  });

  /**
   * Remove socket from every subscription bucket.
   * @param {import('ws')} ws
   */
  function removeFromAll(ws) {
    for (const set of subscriptions.values()) {
      set.delete(ws);
    }
  }

  /**
   * Subscribe socket to a match channel.
   * @param {import('ws')} ws
   * @param {string} matchId
   */
  function subscribe(ws, matchId) {
    removeFromAll(ws);
    if (!subscriptions.has(matchId)) subscriptions.set(matchId, new Set());
    subscriptions.get(matchId).add(ws);
    const m = meta.get(ws);
    if (m) m.matchId = matchId;
  }

  /**
   * Fan out JSON to all sockets for a match.
   * @param {string} matchId
   * @param {object} payload
   */
  function broadcast(matchId, payload) {
    const set = subscriptions.get(matchId);
    if (!set) return;
    for (const ws of set) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const allowed = meta.get(ws)?.streamAllowed;
      const out = allowed ? payload : redactFanoutEnvelope(payload);
      ws.send(JSON.stringify(out));
    }
  }

  /**
   * Handle new WebSocket connection.
   * @param {import('ws')} ws
   * @param {import('http').IncomingMessage} req
   */
  async function onConnection(ws, req) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const matchId = url.searchParams.get('matchId') || '';
    const role = url.searchParams.get('role') || 'viewer';
    const viewerToken = url.searchParams.get('viewerToken') || '';
    const adminToken = url.searchParams.get('adminToken') || '';
    const adminSecret = (url.searchParams.get('adminSecret') || '').trim();
    const expectedSecret = (process.env.ADMIN_SECRET || 'criccast').trim();
    let streamAllowed = false;
    if (viewerToken) {
      const v = verifyViewerToken(viewerToken);
      streamAllowed = !!(v && v.matchId === matchId);
    }
    if (!streamAllowed && adminToken && verifyAdminToken(adminToken)) {
      streamAllowed = true;
    }
    if (!streamAllowed && adminSecret && adminSecret === expectedSecret) {
      streamAllowed = true;
    }
    meta.set(ws, { ws, matchId, role, lastPong: Date.now(), streamAllowed });
    console.log('[ws] connect', { matchId, role, streamAllowed });

    if (matchId) {
      subscribe(ws, matchId);
      try {
        const state = await getMatchState(matchId);
        const data = streamAllowed ? state : redactMatchState(state);
        ws.send(JSON.stringify({ type: 'MATCH_STATE', data }));
      } catch (e) {
        console.error('[ws] initial state error', e.message);
        ws.send(JSON.stringify({ type: 'ERROR', error: 'Failed to load match state' }));
      }
    }

    ws.on('message', (data) => onMessage(ws, data));
    ws.on('close', () => {
      console.log('[ws] disconnect', { matchId });
      chatRelay.closeFor(ws);
      removeFromAll(ws);
      meta.delete(ws);
    });
    ws.on('error', (err) => {
      console.error('[ws] socket error', err.message);
    });
  }

  /**
   * @param {import('ws')} ws
   * @param {import('ws').RawData} data
   */
  function onMessage(ws, data) {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === 'SUBSCRIBE' && msg.matchId) {
      subscribe(ws, msg.matchId);
      const m = meta.get(ws);
      if (m) m.matchId = msg.matchId;
      console.log('[ws] SUBSCRIBE', msg.matchId);
      return;
    }
    if (msg.type === 'PONG') {
      const m = meta.get(ws);
      if (m) m.lastPong = Date.now();
      return;
    }

    /* --- Legacy in-room chat (RTC DataChannel relay + WebSocket Redis fan-out). Replaced by LiveKit data + room guests. Kept for reference. ---
    if (msg.type === 'DC_CHAT_OFFER' && typeof msg.sdp === 'string') {
      void chatRelay.handleOffer(ws, msg.sdp);
      return;
    }
    if (msg.type === 'DC_CHAT_CANDIDATE') {
      void chatRelay.handleClientIce(ws, msg.candidate);
      return;
    }
    if (msg.type === 'CHAT_MESSAGE') {
      const m = meta.get(ws);
      if (!m?.matchId) return;
      const body = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
      let text =
        typeof body.text === 'string'
          ? body.text
              .trim()
              .replace(/\s+/g, ' ')
              .slice(0, 500)
          : '';
      const emoji =
        typeof body.emoji === 'string' ? body.emoji.trim().replace(/\s/g, '').slice(0, 16) : '';
      let displayName =
        typeof body.displayName === 'string'
          ? body.displayName.trim().replace(/\s+/g, ' ').slice(0, 40)
          : '';
      if (!displayName) displayName = 'Fan';
      if (!text && !emoji) return;
      const out = {
        type: 'CHAT_MESSAGE',
        id: randomUUID(),
        displayName,
        text: text || null,
        emoji: emoji || null,
        ts: Date.now(),
      };
      publish(`match:chat:${m.matchId}`, out).catch((e) => console.error('[ws chat]', e.message));
      return;
    }
    --- end legacy chat --- */

    if (msg.type === 'DC_CHAT_OFFER' || msg.type === 'DC_CHAT_CANDIDATE' || msg.type === 'CHAT_MESSAGE') {
      return;
    }
  }

  /**
   * Ping all clients every intervalMs; drop if no PONG within ttlMs.
   * @param {number} intervalMs
   * @param {number} ttlMs
   */
  function startPing(intervalMs = 30000, ttlMs = 10000) {
    return setInterval(() => {
      const now = Date.now();
      for (const [ws, m] of meta.entries()) {
        if (now - m.lastPong > ttlMs) {
          console.log('[ws] terminating idle client', m.matchId);
          try {
            ws.terminate();
          } catch (_) {}
          continue;
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING', t: now }));
        }
      }
    }, intervalMs);
  }

  return { onConnection, broadcast, startPing, subscribe, removeFromAll };
}

module.exports = { createWsHandler };
