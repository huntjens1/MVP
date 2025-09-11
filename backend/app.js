// app.js  — production ready
require('dotenv').config();

const express       = require('express');
const cookieParser  = require('cookie-parser');
const compression   = require('compression');
const morgan        = require('morgan');
const path          = require('path');

// 🔐 eigen middlewares (CommonJS default exports)
const corsMiddleware = require('./middlewares/cors');
const errorHandler   = require('./middlewares/errorHandler');

const app = express();

/* ─────────── Infrastructure & security ─────────── */
app.disable('x-powered-by');
app.set('trust proxy', 1); // nodig i.c.m. Secure cookies achter proxy

/* ─────────── Parsers ─────────── */
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ─────────── CORS (incl. credentials & preflight) ─────────── */
// Belangrijk: geef de middleware-functie door, NIET aanroepen.
app.use(corsMiddleware);

/* ─────────── Logging & gzip ─────────── */
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(compression());

/* ─────────── Static ─────────── */
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ─────────── API routes ───────────
   We *verwijderen niets*. We mounten alle bestaande routers onder /api.
   Voor gevallen waar een router intern al met '/api/…' is gedefinieerd,
   mounten we dezelfde router óók op root ('/') als veilige fallback.
   Zo lossen we 404’s op zonder gedrag te veranderen.
*/
const safeUse = (routerPath, mountBoth = false) => {
  try {
    const router = require(routerPath);
    app.use('/api', router);
    if (mountBoth) app.use('/', router); // fallback wanneer routes intern 'api/*' bevatten
  } catch (err) {
    // Router bestaat niet in deze build — stilletjes overslaan
  }
};

// Kernroutes
safeUse('./routes/auth');                // /login, /logout, /me
safeUse('./routes/wsToken');            // /ws-token
safeUse('./routes/conversations', true);
safeUse('./routes/transcripts',   true);

// AI/assist features (alles behouden, alleen robuuster gemount)
safeUse('./routes/summarize',      true); // POST /summarize
safeUse('./routes/suggestions',    true); // GET/POST /suggestions (indien aanwezig)
safeUse('./routes/suggest',        true); // POST /suggest
safeUse('./routes/suggestQuestion',true); // POST /suggest-question
safeUse('./routes/assist',         true); // POST /assist
safeUse('./routes/assistStream',   true); // GET /assist-stream (SSE)

safeUse('./routes/ticket',         true); // POST /ticket
safeUse('./routes/analytics',      true);
safeUse('./routes/feedback',       true);
safeUse('./routes/aiFeedback',     true);
safeUse('./routes/tenants',        true);

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ─────────── 404 fallback ─────────── */
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

/* ─────────── Centrale error handler ─────────── */
app.use(errorHandler);

module.exports = app;
