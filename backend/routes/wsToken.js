// backend/routes/wsToken.js
const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { normalizeTenant } = require("../utils/keywords");

const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const TTL_SECONDS = 10 * 60;

function inferTenant(req, user) {
  let t = (req.headers["x-tenant"] || req.headers["x-tenant-id"] || "").toString().trim();
  if (!t && user?.email) {
    const dom = (user.email.split("@")[1] || "").toLowerCase();
    t = (dom.split(".")[0] || "").trim();
  }
  return normalizeTenant(t);
}

function issueToken(req, res) {
  try {
    const user = req.user || null;
    const sub = user?.id || user?.user_id || "anon";
    const email = user?.email || null;
    const tenant = inferTenant(req, user);

    const payload = {
      sub,
      scope: "mic",
      agent: email ? { email } : undefined,
      tenant,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    };

    const token = jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
    console.log("[ws-token] issued", {
      user: email || null,
      tenant,
      ttl: TTL_SECONDS,
      conversation_id: req.body?.conversation_id,
    });
    return res.json({ token });
  } catch (err) {
    console.log("[ws-token] error", { error: String(err) });
    return res.status(500).json({ error: "token_failed" });
  }
}

// Ondersteun BEIDE paden om 404's te voorkomen als er een base '/api' wordt gebruikt.
router.post("/api/ws-token", issueToken);
router.post("/ws-token", issueToken);

module.exports = router;
