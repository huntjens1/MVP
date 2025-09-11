// backend/app.js
// Productie-klare Express app (geen app.listen hier!)
// - Strikte CORS met credentials
// - Veilige proxy/cookie settings
// - Consistente debug-logging
// - Monteert bestaande routes als ze aanwezig zijn (fail-safe)
// - Laat SSE en WS routes door proxies werken

const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

const tryRequire = (p) => {
  try { return require(p); } catch { return null; }
};

const compression = tryRequire('compression'); // optioneel
const errorHandler = tryRequire('./middlewares/errorHandler'); // optioneel, blijft ondersteund

// ---- Debug helper ----------------------------------------------------------
const DEBUG_ON = /^true|1|yes$/i.test(String(process.env.DEBUG || 'false'));
const debug = (...args) => { if (DEBUG_ON) console.log('[debug]', ...args); };

// ---- App init --------------------------------------------------------------
const app = express();

// achter proxies (Railway/Vercel) nodig voor Secure cookies / req.ip etc.
app.set('trust proxy', 1);

// basis beveiliging
app.use(helmet({
  contentSecurityPolicy: false, // laat SSE/fetch flexibel — CSP kun je desgewenst apart instellen
}));

// logging
app.use(morgan(DEBUG_ON ? 'dev' : 'combined'));

// parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// optionele compressie
if (compression) app.use(compression());

// ---- CORS (credentials + allowlist) ---------------------------------------
// ALLOWED_ORIGINS = "https://mvp-zeta-rose.vercel.app,http://localhost:5173"
// ALLOWED_ORIGIN_REGEX = "^https:\\/\\/mvp-zeta-rose(?:-[a-z0-9-]+)?\\.vercel\\.app$"
const ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ORIGIN_RE = process.env.ALLOWED_ORIGIN_REGEX
  ? new RegExp(process.env.ALLOWED_ORIGIN_REGEX)
  : null;

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (ORIGINS.includes(origin)) return true;
  if (ORIGIN_RE && ORIGIN_RE.test(origin)) return true;
  return false;
};

const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;
  const allowed = isAllowedOrigin(origin);

  if (allowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  // credentials voor cookies (auth) + SSE/fetch
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );

  if (req.method === 'OPTIONS') {
    debug('CORS preflight', { path: req.path, origin, allowed });
    return res.sendStatus(204);
  }
  return next();
};

// Gebruik zowel custom headers als het cors-package (voor edge-compat)
app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin) ? origin : false),
  credentials: true,
}));
app.use(corsMiddleware);

// Proxy hints voor SSE/streaming
app.use((req, res, next) => {
  // voorkomt buffering bij Nginx/Cloudflare achtige proxies
  res.setHeader('X-Accel-Buffering', 'no');
  next();
});

// ---- Health / meta ---------------------------------------------------------
app.get('/api/health', (req, res) => {
  debug('health check');
  res.status(200).json({ ok: true, ts: Date.now() });
});

// ---- Dynamisch routes mounten (bestaande code blijft werken) --------------
// NB: we monteren alleen wat er daadwerkelijk is, zodat we niets “breken”.
const mountRoute = (path, modPath) => {
  const mod = tryRequire(modPath);
  if (mod) {
    app.use(path, mod);
    debug('route mounted', { path, mod: modPath });
  } else {
    debug('route missing (skipped)', { path, mod: modPath });
  }
};

// Auth & tokens
mountRoute('/api', './routes/auth');           // /api/me, /api/login, /api/logout
mountRoute('/api', './routes/wsToken');        // /api/ws-token

// AI assist/suggest/ticket/summarize (jullie bestaande handlers)
mountRoute('/api', './routes/assist');         // POST /api/assist
mountRoute('/api', './routes/assistStream');   // GET  /api/assist-stream (SSE/stream)
mountRoute('/api', './routes/suggestions');    // GET  /api/suggestions (SSE)
mountRoute('/api', './routes/ticket');         // POST /api/ticket, /api/ticket-skeleton
mountRoute('/api', './routes/summarize');      // POST /api/summarize

// ---- 404 / foutafhandeling -------------------------------------------------
app.use((req, res) => {
  debug('404', { method: req.method, url: req.originalUrl });
  res.status(404).json({ error: 'Not Found' });
});

// eigen errorHandler blijft ondersteund
if (errorHandler) {
  app.use((err, req, res, next) => {
    debug('error middleware', { err: err?.message, stack: err?.stack });
    return errorHandler(err, req, res, next);
  });
} else {
  app.use((err, req, res, next) => {
    debug('unhandled error', { err: err?.message, stack: err?.stack });
    res.status(500).json({ error: 'Internal Server Error' });
  });
}

module.exports = app;
