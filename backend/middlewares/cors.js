const cors = require("cors");

/**
 * Robuuste CORS:
 * - Per-tenant origins via res.locals.tenant_allowed_origins (als tenant al resolved is)
 * - + fallback ALLOWED_ORIGINS (comma list)
 * - + optionele ALLOWED_ORIGIN_REGEX (regex string) voor bv. Vercel previews
 * - Debug met CORS_DEBUG=1
 */

const FALLBACK_LIST = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let REGEX = null;
try {
  if (process.env.ALLOWED_ORIGIN_REGEX) {
    REGEX = new RegExp(process.env.ALLOWED_ORIGIN_REGEX);
  }
} catch {
  REGEX = null;
}

const DEBUG = process.env.CORS_DEBUG === "1";

function decideOrigin(req) {
  const reqOrigin = req.headers.origin || "";
  const perTenant = Array.isArray(req.res?.locals?.tenant_allowed_origins)
    ? req.res.locals.tenant_allowed_origins
    : [];

  // allowlist = per-tenant (indien aanwezig) + fallback uit env
  const allowList = [...new Set([...(perTenant || []), ...FALLBACK_LIST])];

  let allow = false;
  if (!reqOrigin) {
    // Non-browser clients: geen Origin → toestaan
    allow = true;
  } else if (allowList.includes(reqOrigin)) {
    allow = true;
  } else if (REGEX && REGEX.test(reqOrigin)) {
    allow = true;
  }

  if (DEBUG) {
    console.log(
      `[CORS] origin=${reqOrigin || "-"} allow=${allow} ` +
        `perTenant=${JSON.stringify(perTenant)} fallback=${JSON.stringify(FALLBACK_LIST)} ` +
        `regex=${process.env.ALLOWED_ORIGIN_REGEX || "-"}`
    );
  }

  return allow ? reqOrigin : false;
}

const strictCors = cors((req, cb) => {
  const origin = decideOrigin(req);
  cb(null, {
    origin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"],
    exposedHeaders: ["x-request-id"],
    maxAge: 86400,
    preflightContinue: false, // cors handelt OPTIONS af
    optionsSuccessStatus: 204,
  });
});

module.exports = { strictCors };
