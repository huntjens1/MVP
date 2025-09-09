// backend/app.js
const express = require('express');
const cookieParser = require('cookie-parser');

const applyCors = require('./middlewares/cors');
const telemetry = require('./middlewares/telemetry');

// Bestaande routers/services
const auth = require('./routes/auth');
const me = require('./routes/auth'); // me route hangt meestal ook in auth router
const wsToken = require('./routes/wsToken');
const summarize = require('./routes/summarize');
const suggest = require('./routes/suggest');         // POST /api/suggest (bestond al)
const feedback = require('./routes/feedback');
const aiFeedback = require('./routes/aiFeedback');
const transcripts = require('./routes/transcripts');
const conversations = require('./routes/conversations');
const tenants = require('./routes/tenants');
const analytics = require('./routes/analytics');

// 🔥 NIEUW: SSE endpoints
const suggestions = require('./routes/suggestions');  // GET /api/suggestions (SSE)
const assistStream = require('./routes/assistStream'); // GET /api/assist-stream (SSE)

const app = express();

// Basic hardening
app.disable('x-powered-by');

// Telemetry (request id, timing, etc.)
app.use(telemetry());

// JSON & cookies
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// CORS (credentials true + origin allowlist/regex zit in jullie middleware)
app.use(applyCors());

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Auth
app.use('/api', auth);

// Core API
app.use('/api', wsToken);
app.use('/api', summarize);
app.use('/api', suggest);
app.use('/api', feedback);
app.use('/api', aiFeedback);
app.use('/api', transcripts);
app.use('/api', conversations);
app.use('/api', tenants);
app.use('/api', analytics);

// 🔥 Mount de nieuwe SSE-routes (dit voorkómt de 404's die je nu ziet)
app.use('/api', suggestions);   // -> GET /api/suggestions?conversation_id=...
app.use('/api', assistStream);  // -> GET /api/assist-stream?conversation_id=...

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

// Error handler
// (zorgt dat we nette JSON teruggeven)
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.code || 'internal_error',
    message: err.message || 'Unexpected error',
  });
});

module.exports = app;
