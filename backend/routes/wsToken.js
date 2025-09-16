// backend/routes/wsToken.js
const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { normalizeTenant } = require("../utils/keywords");

const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const TTL_SECONDS = 10 * 60;

function inferTenant(req, user) {
  // 1) expliciete header
  let t = (req.headers["x-tenant"] || req.headers["x-tenant-id"] || "").toString().trim();
  // 2) fallback: domein van e-mail (eerste label)
  if (!t && user?.email) {
    const dom = (user.email.split("@")[1] || "").toLowerCase();
    t = (dom.split(".")[0] || "").trim();
  }
  return normalizeTenant(t);
}

router.post("/api/ws-token", (req, res) => {
  try {
    const user = req.user || null;
    const sub = user?.id || user?.user_id || null;
    const email = user?.email || null;
    const tenant = inferTenant(req, user);

    const payload = {
      sub: sub || "anon",
      scope: "mic",
      agent: email ? { email } : undefined,
      tenant,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    };

    const token = jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
    console.log("[ws-token] issued", { user: email || null, tenant, ttl: TTL_SECONDS, conversation_id: req.body?.conversation_id });
    return res.json({ token });
  } catch (err) {
    console.log("[ws-token] error", { error: String(err) });
    return res.status(500).json({ error: "token_failed" });
  }
});

module.exports = router;
