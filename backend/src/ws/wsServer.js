const { WebSocketServer } = require('ws');

/**
 * Attach WebSocket server to existing HTTP server.
 * @param {import('http').Server} server
 * @param {(ws: import('ws'), req: import('http').IncomingMessage) => void} onConnection
 * @returns {import('ws').WebSocketServer}
 */
function attachWebSocketServer(server, onConnection) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', onConnection);
  console.log('[ws] server attached at /ws');
  return wss;
}

module.exports = { attachWebSocketServer };
