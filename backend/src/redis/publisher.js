const Redis = require('ioredis');

let client;

/**
 * Lazily create Redis publisher client.
 * @returns {import('ioredis').Redis}
 */
function getPublisher() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 2,
    });
    client.on('error', (e) => console.error('[redis publisher]', e.message));
  }
  return client;
}

/**
 * Publish JSON message to a Redis channel.
 * @param {string} channel
 * @param {object} payload
 * @returns {Promise<number>} subscriber count
 */
async function publish(channel, payload) {
  const msg = JSON.stringify(payload);
  const n = await getPublisher().publish(channel, msg);
  return n;
}

/**
 * Close publisher connection (tests/shutdown).
 * @returns {Promise<void>}
 */
async function closePublisher() {
  if (client) {
    await client.quit();
    client = null;
  }
}

module.exports = { publish, getPublisher, closePublisher };
