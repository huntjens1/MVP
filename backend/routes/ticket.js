// backend/routes/ticket.js
const express = require('express');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// POST /api/ticket-skeleton
// Body: { conversation_id, customer, ci, category, urgency, impact, tags[], description }
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

    // eenvoudige TTR-heuristiek (u):
    const ttrMap = { P1: 4, P2: 8, P3: 24, P4: 48 };
    const ttr_hours = ttrMap[priority] ?? 48;
    const priorityNumber = Number(String(priority).replace(/\D+/g, '')) || 4;

    const ticket = {
      title,
      description,
      short_description: description, // alias
      summary: title,                 // alias
      ci: ci || 'n.b.',
      priority,
      priorityNumber,                 // alias voor UI die nummer leest
      urgency,
      impact,
      ttr_hours,                      // handig voor UI-badge
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
