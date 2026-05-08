const Redis = require('ioredis');

/**
 * Start Redis PSUBSCRIBE fan-out to WebSocket clients.
 * @param {(matchId: string, channel: string, payload: object) => void} fanOut
 * @returns {Promise<import('ioredis').Redis>}
 */
async function startSubscriber(fanOut) {
  const sub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 2,
  });

  sub.on('error', (e) => console.error('[redis subscriber]', e.message));

  await sub.psubscribe('match:events:*', 'match:overlays:*', 'match:chat:*');

  sub.on('pmessage', (_pattern, channel, message) => {
    try {
      const parts = channel.split(':');
      const matchId = parts[2];
      const payload = JSON.parse(message);
      fanOut(matchId, channel, payload);
    } catch (e) {
      console.error('[redis subscriber] bad message', e.message);
    }
  });

  console.log('[redis subscriber] listening on match:events:*, match:overlays:*, match:chat:*');
  return sub;
}

module.exports = { startSubscriber };
