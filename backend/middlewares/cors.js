const cors = require('cors');

/**
 * Allow-list:
 * - ALLOWED_ORIGINS: komma-gescheiden exacte origins (zonder trailing slash)
 * - ALLOWED_ORIGIN_REGEX: een enkele RegExp string voor bv. Vercel previews
 *
 * Fallback: als er geen envs gezet zijn, whitelist:
 *   - http://localhost:5173
 *   - https://mvp-zeta-rose.vercel.app
 *   - elke preview: https://mvp-zeta-rose-*.vercel.app
 *
 * Zet CORS_DEBUG=1 om elke beslissing te loggen.
 */

const FALLBACK_LIST = ['http://localhost:5173', 'https://mvp-zeta-rose.vercel.app'];
const FALLBACK_REGEX = /^https:\/\/mvp-zeta-rose-.*\.vercel\.app$/;

const listFromEnv = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

let regexFromEnv = null;
try {
  if (process.env.ALLOWED_ORIGIN_REGEX) {
    regexFromEnv = new RegExp(process.env.ALLOWED_ORIGIN_REGEX);
  }
} catch {
  // ignore invalid regex
}

const LIST = listFromEnv.length ? listFromEnv : FALLBACK_LIST;
const REGEX = regexFromEnv || FALLBACK_REGEX;
const DEBUG = process.env.CORS_DEBUG === '1';

function isAllowed(origin) {
  if (!origin) return true;                  // non-browser clients
  if (LIST.includes(origin)) return true;
  if (REGEX && REGEX.test(origin)) return true;
  return false;
}

const delegate = (req, cb) => {
  const origin = req.headers.origin || '';
  const allow = isAllowed(origin);

  if (DEBUG) {
    console.log(
      `[CORS] origin=${origin || '-none-'} allow=${allow} path=${req.method} ${req.originalUrl}`
    );
  }

  cb(null, {
    origin: allow ? origin : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
};

const strictCors = cors(delegate);

module.exports = { strictCors, isAllowed };
