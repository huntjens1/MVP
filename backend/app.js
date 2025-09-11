// backend/app.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();

/* ------------------------------------------------------------------ */
/* Core settings                                                      */
/* ------------------------------------------------------------------ */
app.set('trust proxy', true); // nodig voor cookies/secure achter Railway/NGINX/Heroku

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(compression());

// Helmet: laat COEP/CORP los i.v.m. audio/SSE en verplaats CSP naar front of proxy
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

/* ------------------------------------------------------------------ */
/* CORS – whitelist + regex + credentials                             */
/* ------------------------------------------------------------------ */
const ALLOWED_LIST = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ALLOWED_REGEX = process.env.ALLOWED_ORIGIN_REGEX
  ? new RegExp(process.env.ALLOWED_ORIGIN_REGEX)
  : null;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_LIST.includes(origin)) return true;
  if (ALLOWED_REGEX && ALLOWED_REGEX.test(origin)) return true;
  return false;
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (isAllowedOrigin(origin)) {
    // CORS basis
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    // Zorg dat browsers Set-Cookie zien
    res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
  }

  if (req.method === 'OPTIONS') {
    // Snelle preflight – altijd 204
    return res.sendStatus(204);
  }

  return next();
}

app.use(corsMiddleware);

/* ------------------------------------------------------------------ */
/* Healthcheck                                                        */
/* ------------------------------------------------------------------ */
app.get('/api/healthz', (req, res) =>
  res.json({ ok: true, ts: Date.now(), env: process.env.NODE_ENV })
);

/* ------------------------------------------------------------------ */
/* Routers (bestaande bestanden)                                      */
/*  – NIETS verwijderd; alleen gemount onder /api                     */
/* ------------------------------------------------------------------ */
try { app.use('/api', require('./routes/auth')); } catch {}
try { app.use('/api', require('./routes/suggestions')); } catch {}
try { app.use('/api', require('./routes/assistStream')); } catch {}
try { app.use('/api', require('./routes/assist')); } catch {}
try { app.use('/api', require('./routes/ticket')); } catch {}
try { app.use('/api', require('./routes/ticket-skeleton')); } catch {}
try { app.use('/api', require('./routes/summarize')); } catch {}
try { app.use('/api', require('./routes/suggest')); } catch {}
try { app.use('/api', require('./routes/suggestQuestion')); } catch {}
try { app.use('/api', require('./routes/wsToken')); } catch {}

/* ------------------------------------------------------------------ */
/* Fallback /api/me (niet-invasief)                                   */
/*  – sommige deploys misten deze route.                              */
/*  – leest JWT uit httpOnly cookie en geeft 200/401.                 */
/* ------------------------------------------------------------------ */
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.AUTH_SECRET || // mocht dit bij jullie zo heten
  'change-me-in-production';

app.get('/api/me', (req, res, next) => {
  // Als een andere router al /api/me afhandelt, komt code hier niet.
  // Deze fallback is idempotent en niet-invasief.
  if (!req.cookies || !req.cookies[AUTH_COOKIE]) return res.sendStatus(401);

  try {
    const payload = jwt.verify(req.cookies[AUTH_COOKIE], JWT_SECRET);
    // Houd payload klein en veilig
    const { sub, email, name, roles, tenant } = payload || {};
    return res.json({ sub, email, name, roles: roles || [], tenant: tenant || null });
  } catch (err) {
    return res.sendStatus(401);
  }
});

/* ------------------------------------------------------------------ */
/* 404 & error handler                                                */
/* ------------------------------------------------------------------ */
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  return next();
});

// Jullie eigen error handler laten staan als hij bestaat
try {
  const errorHandler = require('./middlewares/errorHandler');
  app.use(errorHandler);
} catch {
  // minimal fallback
  app.use((err, req, res, _next) => {
    console.error('[error]', err);
    res.status(err.status || 500).json({ error: 'Internal Server Error' });
  });
}

/* ------------------------------------------------------------------ */
/* HTTP server + Deepgram bridge                                      */
/* ------------------------------------------------------------------ */
const PORT = process.env.PORT || 8080;
const server = http.createServer(app);

try {
  // ./ws/deepgramBridge.js moet exporteren: attachDeepgramMicBridge(server, path)
  const { attachDeepgramMicBridge } = require('./ws/deepgramBridge');
  attachDeepgramMicBridge(server, '/ws/mic');
} catch (e) {
  console.warn('[ws] deepgramBridge not attached:', e?.message || e);
}

server.listen(PORT, () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});

module.exports = app;
