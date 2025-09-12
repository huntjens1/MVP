// backend/routes/ticket.js
const express = require('express');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// POST /api/ticket-skeleton
router.post('/ticket-skeleton', requireAuth, async (req, res) => {
  try {
    const {
      conversation_id,
      customer,
      ci,
      category = 'Service Request',
      urgency = 'Medium',
      impact = 'Low',
      tags = [],
      description = '—',
    } = req.body || {};

    const title = `[${category}] ${customer || 'Onbekende klant'} - ${ci || 'n.b.'}`;
    const priority = derivePriority(urgency, impact);

    const ticket = {
      title,
      description,
      ci: ci || 'n.b.',
      priority,
      category,
      urgency,
      impact,
      tags: Array.isArray(tags) ? tags : [],
      meta: { conversation_id: conversation_id || null },
    };

    console.debug('[ticket] skeleton', { conversation_id, priority, category });
    return res.json({ ticket });
  } catch (err) {
    console.error('[ticket] skeleton error', { error: err?.message });
    return res.status(500).json({ error: 'ticket_skeleton_failed' });
  }
});

function derivePriority(urgency, impact) {
  const map = { Low: 4, Medium: 3, High: 2, Critical: 1 };
  const u = map[urgency] ?? 3;
  const i = map[impact] ?? 4;
  return `P${Math.min(4, Math.max(1, Math.round((u + i) / 2)))}`;
}

module.exports = router;
