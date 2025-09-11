// utils/logger.js
const fmt = (obj) => {
  try { return JSON.stringify(obj); } catch { return String(obj); }
};

const ts = () => new Date().toISOString();

module.exports = {
  info:  (msg, ctx={}) => console.log(`[INFO]  ${ts()} ${msg} ${fmt(ctx)}`),
  warn:  (msg, ctx={}) => console.warn(`[WARN]  ${ts()} ${msg} ${fmt(ctx)}`),
  debug: (msg, ctx={}) => console.debug(`[DEBUG] ${ts()} ${msg} ${fmt(ctx)}`),
  error: (msg, ctx={}) => console.error(`[ERROR] ${ts()} ${msg} ${fmt(ctx)}`)
};
