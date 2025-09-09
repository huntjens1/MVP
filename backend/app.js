// backend/app.js
const express = require('express');

const applyCors = require('./middlewares/cors');
const telemetry = require('./middlewares/telemetry');

// Bestaande routers/services
const auth = require('./routes/auth');
const wsToken = require('./routes/wsToken');
const summarize = require('./routes/summarize');
const suggest = require('./routes/suggest');
const feedback = require('./routes/feedback');
const aiFeedback = require('./routes/aiFeedback');
const transcripts = require('./routes/transcripts');
const conversations = require('./routes/conversations');
const tenants = require('./routes/tenants');
const analytics = require('./routes/analytics');

// 🔥 NIEUW: SSE endpoints
const suggestions = require('./routes/suggestions');    // GET /api/suggestions
const assistStream = require('./routes/assistStream');  // GET /api/assist-stream

// --- Optionele cookie-parser (fallback als package ontbreekt) ---
let cookieParser = null;
try {
  // Probeer echte cookie-parser te gebruiken als hij geïnstalleerd is
  cookieParser = require('cookie-parser');
} catch (_) {
  cookieParser = null;
}

// Kleine veilige parser als fallback (alleen eenvoudige name=value;name2=value2)
function fallbackCookieMiddleware(req, _res, next) {
  const header = req.headers.cookie || '';
  const out = {};
  if (header) {
    header.split(';').forEach(pair => {
      const i = pair.indexOf('=');
      const k = decodeURIComponent((i > -1 ? pair.slice(0, i) : pair).trim());
      const v = i > -1 ? decodeURIComponent(pair.slice(i + 1).trim()) : '';
      if (k) out[k] = v;
    });
  }
  req.cookies = out;
  next();
}
// ----------------------------------------------------------------

const app = express();
app.disable('x-powered-by');

// Telemetry
app.use(telemetry());

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Cookies
if (cookieParser) {
  app.use(cookieParser());
} else {
  app.use(fallbackCookieMiddleware);
}

// CORS
app.use(applyCors());

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Auth & core API
app.use('/api', auth);
app.use('/api', wsToken);
app.use('/api', summarize);
app.use('/api', suggest);
app.use('/api', feedback);
app.use('/api', aiFeedback);
app.use('/api', transcripts);
app.use('/api', conversations);
app.use('/api', tenants);
app.use('/api', analytics);

// 🔥 Mount SSE-routes (fix voor 404 op /api/suggestions en /api/assist-stream)
app.use('/api', suggestions);
app.use('/api', assistStream);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({
    error: err.code || 'internal_error',
    message: err.message || 'Unexpected error',
  });
});

module.exports = app;
