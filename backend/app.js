// app.js  — Production-ready Express bootstrap (keeps your features intact)
'use strict';

/* ----------------------------------------
 * 1)  Basics & safety
 * -------------------------------------- */
require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const compression = require('compression');
const helmet = require('helmet');

/* ----------------------------------------
 * 2)  Helpers to load local modules no matter
 *     where you placed the files during refactors
 * -------------------------------------- */
const tryRequire = (candidates) => {
  for (const p of candidates) {
    try { return require(p); } catch { /* continue */ }
  }
  throw new Error(`Module not found. Tried: ${candidates.join(', ')}`);
};

/* ----------------------------------------
 * 3)  Local middleware (CORS & errors)
 * -------------------------------------- */
const corsMiddleware = tryRequire([
  './middlewares/cors',
  './cors'
]);

const errorHandler = tryRequire([
  './middlewares/errorHandler',
  './errorHandler'
]);

/* ----------------------------------------
 * 4)  Routes (we only *add* hooks; we do not remove anything)
 *     If a route file doesn’t exist in your repo, the tryRequire will throw.
 *     Leave out the ones you really don’t have.
 * -------------------------------------- */
const authRoutes          = tryRequire(['./routes/auth']);
const wsTokenRoutes       = tryRequire(['./routes/wsToken']);

const suggestionsRoutes   = tryRequire(['./routes/suggestions']);
const assistStreamRoutes  = tryRequire(['./routes/assistStream']);
const assistRoutes        = tryRequire(['./routes/assist']);
const suggestRoutes       = tryRequire(['./routes/suggest']);
const suggestQuestion     = tryRequire(['./routes/suggestQuestion']);
const ticketRoutes        = tryRequire(['./routes/ticket']);
const summarizeRoutes     = tryRequire(['./routes/summarize']);
const conversationsRoutes = tryRequire(['./routes/conversations']);
const transcriptsRoutes   = tryRequire(['./routes/transcripts']);
const analyticsRoutes     = tryRequire(['./routes/analytics']);
const feedbackRoutes      = tryRequire(['./routes/feedback']);
const aiFeedbackRoutes    = tryRequire(['./routes/aiFeedback']);
const tenantsRoutes       = tryRequire(['./routes/tenants']);

/* ----------------------------------------
 * 5)  WebSocket bridge (Deepgram) — path /ws/mic
 * -------------------------------------- */
const deepgramBridge = (() => {
  try { return require('./ws/deepgramBridge'); } catch { return require('./deepgramBridge'); }
})();

/* ----------------------------------------
 * 6)  App setup
 * -------------------------------------- */
const app = express();

// Behind Railway/Render/Heroku proxies
app.set('trust proxy', 1);

// Harden headers (keep it minimal to avoid breaking features)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));

// Gzip
app.use(compression());

// Logging (production-friendly)
app.use(morgan(process.env.LOG_FORMAT || 'tiny'));

// Body & cookies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// CORS (credentials + fine-grained allow list)
app.use(corsMiddleware);

// Health & sanity endpoints
app.get('/health', (_, res) => res.status(200).send('OK'));
app.get('/', (_, res) => res.status(200).send('calllogix-backend'));

/* ----------------------------------------
 * 7)  Mount API routes — nothing removed, only added in one place
 * -------------------------------------- */
// Auth & session
app.use('/api', authRoutes);           // /api/login, /api/logout, /api/me
app.use('/api', wsTokenRoutes);        // /api/ws-token

// Core AI features
app.use('/api', suggestionsRoutes);    // GET /api/suggestions
app.use('/api', assistStreamRoutes);   // GET /api/assist-stream
app.use('/api', assistRoutes);         // POST /api/assist
app.use('/api', suggestRoutes);        // POST /api/suggest
app.use('/api', suggestQuestion);      // POST /api/suggest-question
app.use('/api', ticketRoutes);         // POST /api/ticket, /api/ticket-skeleton
app.use('/api', summarizeRoutes);      // POST /api/summarize

// Domain routes
app.use('/api', conversationsRoutes);
app.use('/api', transcriptsRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', feedbackRoutes);
app.use('/api', aiFeedbackRoutes);
app.use('/api', tenantsRoutes);

/* ----------------------------------------
 * 8)  404 for unknown API routes (keep last)
 * -------------------------------------- */
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Not Found' });
  }
  return next();
});

/* ----------------------------------------
 * 9)  Global error handler (kept)
 * -------------------------------------- */
app.use(errorHandler);

/* ----------------------------------------
 * 10) Start HTTP server and attach WS bridge
 * -------------------------------------- */
const PORT = Number(process.env.PORT || 8080);
const server = http.createServer(app);

server.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`[calllogix] backend listening on :${PORT}`);
  /* eslint-enable no-console */
});

// Attach Deepgram WS bridge on /ws/mic once the server is ready
try {
  deepgramBridge.attach(server, { path: '/ws/mic' });
  console.log('[ws] Deepgram mic bridge attached on /ws/mic');
} catch (err) {
  console.warn('[ws] deepgramBridge not attached:', err?.message || err);
}

/* ----------------------------------------
 * 11) Process-level guards (don’t remove, just safer)
 * -------------------------------------- */
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

module.exports = app;
