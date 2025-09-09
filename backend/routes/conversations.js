// backend/routes/conversations.js (CommonJS)
const express = require('express');
const { requireAuth } = require('../middlewares/auth');

// In-memory store als fallback voor MVP (vervang later door DB/Supabase)
const { randomUUID } = require('crypto');
const conversations = new Map();

const router = express.Router();

/**
 * POST /api/conversations
 * Start een nieuwe conversatie
 */
router.post('/api/conversations', requireAuth, async (req, res) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  const user = req.user || {};

  const convo = {
    id,
    tenant_id: user.tenant_id || null,
    agent_id: user.id || null,
    customer_id: req.body?.customer_id ?? null,
    status: 'open',
    started_at: now,
    ended_at: null,
    duration_seconds: null,
    priority: 'normaal',
    impact: null,
    urgency: null,
    itil_category: null,
    transcript: null,
    sla_due: null,
  };

  conversations.set(id, convo);
  return res.json({ conversation: convo });
});

/**
 * GET /api/conversations
 * Eenvoudige listing voor de huidige tenant (MVP)
 */
router.get('/api/conversations', requireAuth, async (req, res) => {
  const tid = req.user?.tenant_id;
  const items = [...conversations.values()].filter(c => !tid || c.tenant_id === tid);
  return res.json({ items });
});

/**
 * PATCH /api/conversations/:id
 * Update meta (status, priority, transcript, …)
 */
router.patch('/api/conversations/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const exists = conversations.get(id);
  if (!exists) return res.status(404).json({ error: 'not_found' });

  // Alleen bekende keys updaten
  const allowed = ['status', 'impact', 'urgency', 'itil_category', 'priority', 'transcript', 'sla_due'];
  for (const k of allowed) if (k in req.body) exists[k] = req.body[k];

  conversations.set(id, exists);
  return res.json({ conversation: exists });
});

/**
 * POST /api/conversations/:id/close
 * Sluit conversatie en bereken duur
 */
router.post('/api/conversations/:id/close', requireAuth, async (req, res) => {
  const { id } = req.params;
  const c = conversations.get(id);
  if (!c) return res.status(404).json({ error: 'not_found' });

  const ended_at = new Date().toISOString();
  const started = c.started_at ? new Date(c.started_at).getTime() : Date.now();
  const duration = Math.max(0, Math.round((Date.now() - started) / 1000));

  c.status = 'afgesloten';
  c.ended_at = ended_at;
  c.duration_seconds = duration;

  conversations.set(id, c);
  return res.json({ conversation: c });
});

module.exports = router;
