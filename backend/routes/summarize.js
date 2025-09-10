const express = require('express');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/summarize', requireAuth, async (req, res) => {
  const { conversation_id } = req.body || {};
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });

  res.json({
    conversation_id,
    summary: 'Samenvatting (placeholder).',
    actions: [],
    tags: [],
  });
});

module.exports = router;
