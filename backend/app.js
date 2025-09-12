// backend/app.js
// Express app: security, CORS, cookies, logging, routes, errors.

'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const applyCors = require('./middlewares/cors');
const { requestLogger } = require('./middlewares/debug');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());

// In productie geen bodies loggen; headers/paden wel
app.use(requestLogger({ logBodies: process.env.NODE_ENV !== 'production' }));

const COOKIE_SECRET = process.env.COOKIE_SECRET || undefined;
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(COOKIE_SECRET));
app.use(applyCors());

app.use('/public', express.static(path.join(__dirname, 'public')));

// ------- Route mounting helpers (CJS + ESM) -------

/**
 * Resolve a route module; supports:
 *  - CommonJS require
 *  - ESM via dynamic import() when CJS require fails with ESM error
 *  - Exports: router | default.router | default
 */
function resolveRouterSync(rel) {
  // Try CJS require first (fast path)
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require(rel);
    return pickRouter(mod);
  } catch (e) {
    // If it's clearly an ESM parse/require error, we don't treat it as a hard error
    const msg = String(e && e.message || '');
    const code = e && e.code;
    if (
      code === 'ERR_REQUIRE_ESM' ||
      msg.includes('Cannot use import statement outside a module')
    ) {
      // Mark for async ESM mount
      return { __ESM__: true, __path__: rel };
    }
    // If file truly missing, just skip quietly
    if (code === 'MODULE_NOT_FOUND' || msg.includes('Cannot find module')) {
      return null;
    }
    // Unknown error: log once and skip
    console.debug('[require] failed', { path: rel, error: msg });
    return null;
  }
}

/**
 * After app is running, we can mount ESM routes asynchronously.
 */
async function mountEsmLater(name, rel) {
  try {
    const abs = require.resolve(rel, { paths: [__dirname] });
    const url = pathToFileURL(abs).href;
    const mod = await import(url);
    const router = pickRouter(mod);
    if (router) {
      app.use('/api', router);
      console.debug('[routes] mounted (esm)', { name });
      return;
    }
  } catch (e) {
    const msg = String(e && e.message || '');
    if (msg.includes('Cannot find module') || (e && e.code === 'ERR_MODULE_NOT_FOUND')) {
      console.debug('[routes] skipped (missing)', { name });
      return;
    }
    console.debug('[routes] skipped (esm failed)', { name, error: msg });
    return;
  }
}

/**
 * Try to find an Express router export in a module
 */
function pickRouter(mod) {
  if (!mod) return null;
  // express.Router() is a function; app.use accepts functions with handle property
  if (typeof mod === 'function') return mod;
  if (mod.router && (typeof mod.router === 'function' || typeof mod.router?.handle === 'function')) return mod.router;
  if (mod.default && (typeof mod.default === 'function' || typeof mod.default?.handle === 'function')) return mod.default;
  return null;
}

function mount(name, relPath) {
  const rel = path.join(__dirname, relPath);

  // If file obviously doesn't exist in any extension, skip fast.
  const existsLikely =
    fs.existsSync(rel) ||
    fs.existsSync(`${rel}.js`) ||
    fs.existsSync(`${rel}.cjs`) ||
    fs.existsSync(`${rel}.mjs`) ||
    fs.existsSync(path.join(rel, 'index.js')) ||
    fs.existsSync(path.join(rel, 'index.mjs')) ||
    fs.existsSync(path.join(rel, 'index.cjs'));

  if (!existsLikely) {
    console.debug('[routes] skipped (missing)', { name });
    return;
  }

  const res = resolveRouterSync(rel);
  if (!res) {
    console.debug('[routes] skipped (missing)', { name });
    return;
  }
  if (res.__ESM__) {
    // Defer ESM mount to next tick; server kan alvast starten
    setImmediate(() => {
      mountEsmLater(name, rel).catch(() => {});
    });
    console.debug('[routes] pending (esm)', { name });
    return;
  }

  const router = res;
  app.use('/api', router);
  console.debug('[routes] mounted', { name });
}

// ------- Mount known routes (volgorde behouden) -------

mount('auth',          './routes/auth');
mount('wsToken',       './routes/wsToken');
mount('assist',        './routes/assist');
mount('suggest',       './routes/suggestions'); // bevat GET /api/suggestions (SSE) + POST /api/suggest
mount('assistStream',  './routes/assistStream');
mount('suggestions',   './routes/suggestions'); // SSE is hierbinnen
mount('summarize',     './routes/summarize');
mount('ticket',        './routes/ticket');

// Overige optionele routes (CJS/ESM beide ok, geen errors in logs)
mount('analytics',     './routes/analytics');
mount('aiFeedback',    './routes/aiFeedback');
mount('feedback',      './routes/feedback');
mount('transcripts',   './routes/transcripts');
mount('conversations', './routes/conversations');
mount('tenants',       './routes/tenants');

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// 404
app.use((req, res) => {
  console.debug('[http] 404', { method: req.method, path: req.originalUrl });
  res.status(404).json({ error: 'Not Found' });
});

// Error handler (laatste)
app.use(errorHandler);

module.exports = app;
