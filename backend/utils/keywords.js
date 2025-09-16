// backend/utils/keywords.js
// Centrale keyword-utility met tenant-ondersteuning.
// Laadt DG_KEYWORDS_<TENANT> (fallback naar DG_KEYWORDS), voegt agentnaam toe,
// sane defaults, unieke compact lijst.

const MAX_ITEMS = 40;
const MAX_TOKEN_LEN = 48;

function splitCsv(str) {
  if (!str) return [];
  return String(str)
    .split(/[;,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleCase(s) {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

function sanitize(list) {
  return list
    .map((x) => String(x).trim())
    .filter(Boolean)
    .map((x) => x.replace(/\s+/g, " "))
    .filter((x) => x.length <= MAX_TOKEN_LEN)
    .filter((x) => !/^[\W_]+$/.test(x));
}

function uniqueCaseFold(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const k = x.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

// ----- Tenant helpers -----
function normalizeTenant(tenant) {
  const t = String(tenant || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return t || "default";
}
function envKeyForTenant(tenant) {
  const norm = normalizeTenant(tenant).toUpperCase();
  return norm === "DEFAULT" ? "DG_KEYWORDS" : `DG_KEYWORDS_${norm}`;
}

// ----- Sources -----
function fromEnv(tenant) {
  const envKey = envKeyForTenant(tenant);
  const raw = process.env[envKey] || process.env.DG_KEYWORDS || "";
  return splitCsv(raw);
}
function fromAgentEmail(email) {
  if (!email || typeof email !== "string") return [];
  const local = email.split("@")[0] || "";
  const parts = local.split(/[.\-+_]/g).filter(Boolean);
  const blacklist = new Set(["info", "service", "support", "admin", "helpdesk", "servicedesk"]);
  const tokens = parts
    .map((p) => p.replace(/\d+/g, ""))
    .filter((p) => p.length >= 2)
    .filter((p) => !blacklist.has(p.toLowerCase()))
    .map(titleCase);
  const first = tokens[0] ? [tokens[0]] : [];
  return Array.from(new Set([...first, ...tokens]));
}

// ----- Public API -----
function buildKeywordList({ tenant, agentEmail, extra = [] } = {}) {
  const base = fromEnv(tenant);
  const agent = fromAgentEmail(agentEmail);
  const merged = uniqueCaseFold(sanitize([...base, ...agent, ...extra]));
  return merged.slice(0, MAX_ITEMS);
}

module.exports = {
  buildKeywordList,
  normalizeTenant,
  envKeyForTenant,
};
