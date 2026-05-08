const { randomUUID } = require('crypto');
const { WebSocket } = require('ws');
const {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} = require('@roamhq/wrtc');

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function candToPlain(c) {
  if (!c) return null;
  if (typeof c.toJSON === 'function') return c.toJSON();
  return {
    candidate: c.candidate,
    sdpMid: c.sdpMid,
    sdpMLineIndex: c.sdpMLineIndex,
    usernameFragment: c.usernameFragment,
  };
}

function sendJson(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (_) {}
  }
}

function sanitizeInbound(body) {
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
  if (!text && !emoji) return null;
  return {
    type: 'CHAT_MESSAGE',
    id: randomUUID(),
    displayName,
    text: text || null,
    emoji: emoji || null,
    ts: Date.now(),
  };
}

/**
 * Relay live chat across viewers via RTCDataChannel (negotiated peer per WebSocket; WS is signalling only).
 * @param {{
 *   publish: (channel: string, payload: object) => Promise<unknown>
 *   getMatchId: (ws: import('ws')) => string
 *   socketsForMatch: (matchId: string) => Set<import('ws')>|undefined|null
 * }} deps
 */
function createChatDataChannelRelay({ publish, getMatchId, socketsForMatch }) {
  /** @type {Map<import('ws'), { pc: RTCPeerConnection, dc: import('@roamhq/wrtc').RTCDataChannel | null, remoteDone: boolean, queuedIce: object[] }>} */
  const peers = new Map();

  /**
   * @param {string} matchId
   * @param {string} jsonString
   */
  function relayToAllDataChannels(matchId, jsonString) {
    const set = socketsForMatch(matchId);
    if (!set) return;
    for (const sock of set) {
      const rec = peers.get(sock);
      const ch = rec?.dc;
      if (ch && ch.readyState === 'open') {
        try {
          ch.send(jsonString);
        } catch (_) {}
      }
    }
  }

  /**
   * @param {import('ws')} ws
   */
  function teardown(ws) {
    const rec = peers.get(ws);
    if (!rec) return;
    peers.delete(ws);
    try {
      rec.pc.close();
    } catch (_) {}
  }

  /**
   * @param {import('ws')} ws
   * @param {string} sdpOffer
   */
  async function handleOffer(ws, sdpOffer) {
    const matchId = getMatchId(ws);
    if (!matchId || !sdpOffer.trim()) return;

    teardown(ws);

    /** @type {import('@roamhq/wrtc').RTCPeerConnection} */
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    /** @type {{ pc: InstanceType<RTCPeerConnection>, dc: import('@roamhq/wrtc').RTCDataChannel|null, remoteDone: boolean, queuedIce: object[] }} */
    const rec = { pc, dc: null, remoteDone: false, queuedIce: [] };
    peers.set(ws, rec);

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const plain = candToPlain(e.candidate);
      if (plain) sendJson(ws, { type: 'DC_CHAT_CANDIDATE', candidate: plain });
    };

    pc.ondatachannel = ({ channel }) => {
      rec.dc = channel;
      channel.onmessage = (ev) => {
        const raw = typeof ev.data === 'string' ? ev.data : null;
        if (!raw || raw.length > 4096) return;
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          return;
        }
        const out = sanitizeInbound(body);
        if (!out) return;

        relayToAllDataChannels(matchId, JSON.stringify(out));
        publish(`match:chat:${matchId}`, out).catch((e) => console.error('[dc relay publish]', e.message));
      };

      channel.onerror = () => {
        console.warn('[dc chat] sender channel error', matchId);
      };
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));
      rec.remoteDone = true;
      for (const plain of rec.queuedIce.splice(0)) {
        await pc.addIceCandidate(new RTCIceCandidate(plain));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendJson(ws, { type: 'DC_CHAT_ANSWER', sdp: answer.sdp });
    } catch (e) {
      console.error('[dc chat] offer failed', e.message);
      sendJson(ws, { type: 'DC_CHAT_ERROR', error: String(e.message || 'Negotiation failed') });
      teardown(ws);
    }
  }

  /**
   * @param {import('ws')} ws
   * @param {object|null|undefined} candidate
   */
  async function handleClientIce(ws, candidate) {
    if (!candidate || typeof candidate !== 'object') return;
    const rec = peers.get(ws);
    if (!rec) return;
    try {
      if (!rec.remoteDone || !rec.pc.remoteDescription) {
        rec.queuedIce.push(candidate);
        return;
      }
      await rec.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('[dc chat] addIce failed', e.message);
    }
  }

  /**
   * @param {import('ws')} ws
   */
  function closeFor(ws) {
    teardown(ws);
  }

  return { handleOffer, handleClientIce, closeFor };
}

module.exports = { createChatDataChannelRelay };
