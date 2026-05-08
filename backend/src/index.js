require('dotenv').config();
const http = require('http');
const express = require('express');

const matchRouter = require('./routes/match');
const matchByIdRouter = require('./routes/matchById');
const ballRouter = require('./routes/ball');
const overRouter = require('./routes/over');
const overlayRouter = require('./routes/overlay');
const streamRouter = require('./routes/stream');
const healthRouter = require('./routes/health');
const matchDB = require('./db/matchDB');
const { sendDbAwareError } = require('./utils/dbHttpError');

const { attachWebSocketServer } = require('./ws/wsServer');
const { createWsHandler } = require('./ws/wsHandler');
const { startSubscriber } = require('./redis/subscriber');

const PORT = Number(process.env.PORT) || 3001;

/** Comma-separated list, e.g. http://localhost:5173 — required for Vite dev server + API on another port */
const CORS_ALLOWLIST = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ALLOWLIST.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

app.use(healthRouter);

app.get('/api/matches/live', async (req, res) => {
  try {
    const rows = await matchDB.listMatchesForHome();
    const live = rows.filter((r) => r.status === 'LIVE');
    const recent = rows.filter((r) => r.status === 'COMPLETE');
    return res.json({ data: { live, recent, matches: rows }, message: 'OK' });
  } catch (e) {
    return sendDbAwareError(res, e, '[matches live]', 'Failed to list live matches');
  }
});

app.use('/api/match', matchRouter);
app.use('/api/match/:id', matchByIdRouter);
app.use('/api/match/:id', ballRouter);
app.use('/api/match/:id', overRouter);
app.use('/api/match/:id', overlayRouter);
app.use('/api/match/:id', streamRouter);

app.use((err, _req, res, _next) => {
  console.error('[express]', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
});

const server = http.createServer(app);

/** @type {Map<string, Set<import('ws')>>} */
const subscriptions = new Map();
const wsHandler = createWsHandler(subscriptions);
attachWebSocketServer(server, (ws, req) => wsHandler.onConnection(ws, req));

wsHandler.startPing(30000, 10000);

startSubscriber((matchId, channel, payload) => {
  const topic = channel.includes('overlays')
    ? 'OVERLAY'
    : channel.includes('chat')
      ? 'CHAT'
      : 'EVENT';
  console.log('[ws fanout]', topic, matchId);
  wsHandler.broadcast(matchId, { channel, payload });
}).catch((e) => {
  console.error('[subscriber failed]', e.message);
});

server.listen(PORT, () => {
  console.log(`[criccast] listening on :${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException', err);
});

module.exports = { app, server };
