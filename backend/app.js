// backend/app.js
// Express app: security, CORS, cookies, logging, routes, errors.

const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');

const applyCors = require('./middlewares/cors');
const { requestLogger } = require('./middlewares/debug');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Zorg dat SameSite=None; Secure cookies werken achter Railway proxy
app.set('trust proxy', 1);

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Compressie
app.use(compression());

// Request logging met request-id en redactie
app.use(requestLogger({
  logBodies: process.env.NODE_ENV !== 'production',
}));

// Body & cookies
const COOKIE_SECRET = process.env.COOKIE_SECRET || undefined; // optioneel signed cookies
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(COOKIE_SECRET));

// CORS met credentials (cookies)
app.use(applyCors());

// Testpagina’s (optioneel)
app.use('/public', express.static(path.join(__dirname, 'public')));

// ---------- Routes ----------
const mount = (name, router) => {
  if (router) {
    app.use('/api', router);
    console.debug('[routes] mounted', { name });
  } else {
    console.debug('[routes] skipped (missing)', { name });
  }
};

function safeRequire(p) {
  try {
    const mod = require(p);
    return mod && mod.router ? mod.router : mod;
  } catch (e) {
    console.debug('[require] failed', { path: p, error: e?.message });
    return null;
  }
}

// Kernroutes (frontend afhankelijk)
mount('auth',          safeRequire('./routes/auth'));
mount('wsToken',       safeRequire('./routes/wsToken'));
mount('assist',        safeRequire('./routes/assist'));
mount('assistStream',  safeRequire('./routes/assistStream'));
mount('suggestions',   safeRequire('./routes/suggestions'));
mount('summarize',     safeRequire('./routes/summarize'));
mount('ticket',        safeRequire('./routes/ticket'));

// Overige aanwezige routes (niet aangeraakt, blijven werken)
mount('analytics',     safeRequire('./routes/analytics'));
mount('aiFeedback',    safeRequire('./routes/aiFeedback'));
mount('feedback',      safeRequire('./routes/feedback'));
mount('transcripts',   safeRequire('./routes/transcripts'));
mount('conversations', safeRequire('./routes/conversations'));
mount('tenants',       safeRequire('./routes/tenants'));

// Health
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// 404
app.use((req, res) => {
  console.debug('[http] 404', { method: req.method, path: req.originalUrl });
  res.status(404).json({ error: 'Not Found' });
});

// Errors
app.use(errorHandler);

module.exports = app;
