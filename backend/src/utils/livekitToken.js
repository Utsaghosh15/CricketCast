const { AccessToken } = require('livekit-server-sdk');

/**
 * LiveKit room name for a match.
 * @param {string} matchId
 */
function livekitRoomName(matchId) {
  return `match-${matchId}`;
}

/**
 * Mint a participant access token for LiveKit Cloud.
 * @param {{
 *   apiKey: string,
 *   apiSecret: string,
 *   livekitUrl: string,
 *   roomName: string,
 *   identity: string,
 *   name: string,
 *   canPublish: boolean,
 * }} opts
 * @returns {Promise<{ token: string, url: string, roomName: string }>}
 */
async function mintLiveKitToken(opts) {
  const { apiKey, apiSecret, livekitUrl, roomName, identity, name, canPublish } = opts;
  const at = new AccessToken(apiKey, apiSecret, {
    identity: String(identity).slice(0, 128),
    name: String(name || '').slice(0, 128),
    ttl: process.env.LIVEKIT_TOKEN_TTL || '6h',
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: !!canPublish,
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();
  return { token, url: livekitUrl, roomName };
}

module.exports = { livekitRoomName, mintLiveKitToken };
