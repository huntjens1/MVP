// app.js
const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Middlewares (CommonJS default exports)
const corsMiddleware = require('./middlewares/cors');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

/* ---------- Security & infra ---------- */
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ---------- Parsers ---------- */
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------- CORS (credentials + preflight) ---------- */
// IMPORTANT: pass the middleware FUNCTION, do not call it here.
app.use(corsMiddleware);

/* ---------- Logging & gzip ---------- */
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(compression());

/* ---------- Static (optional) ---------- */
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ---------- API routes (all CommonJS routers) ---------- */
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/wsToken'));
app.use('/api', require('./routes/conversations'));
app.use('/api', require('./routes/transcripts'));
app.use('/api', require('./routes/summarize'));
app.use('/api', require('./routes/suggestions'));
app.use('/api', require('./routes/assistStream'));

// Mount optional routers only if present
[
  './routes/assist',
  './routes/analytics',
  './routes/feedback',
  './routes/aiFeedback',
  './routes/tenants',
  './routes/ticket',
  './routes/suggest',
  './routes/suggestQuestion',
].forEach(p => {
  try {
    app.use('/api', require(p));
  } catch (_) {
    // Router file not present in this build — skip silently
  }
});

/* ---------- 404 ---------- */
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

/* ---------- Global error handler ---------- */
app.use(errorHandler);

module.exports = app;
