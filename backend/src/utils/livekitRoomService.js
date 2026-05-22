const { RoomServiceClient } = require('livekit-server-sdk');

/**
 * RoomService Twirp expects https host; LIVEKIT_URL is often wss:// for clients.
 * @param {string} url
 */
function livekitHttpHost(url) {
  const u = String(url || '').trim();
  if (u.startsWith('wss://')) return `https://${u.slice(6)}`;
  if (u.startsWith('ws://')) return `http://${u.slice(5)}`;
  return u;
}

function getRoomServiceClient() {
  const raw = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!raw || !apiKey || !apiSecret) return null;
  const host = livekitHttpHost(raw);
  return new RoomServiceClient(host, apiKey, apiSecret);
}

module.exports = { getRoomServiceClient, livekitHttpHost };
