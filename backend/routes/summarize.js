// backend/routes/summarize.js
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { summarizeTranscriptNL } = require('../services/openai');

const router = express.Router();

// POST /api/summarize
router.post('/summarize', requireAuth, async (req, res) => {
  const { transcript = '', context = {} } = req.body || {};
  try {
    const summary = await summarizeTranscriptNL(transcript, context);
    return res.json({ summary });
  } catch (err) {
    console.error('[summarize] error', { error: err?.message });
    return res.status(500).json({ error: 'summarize_failed' });
  }
});

module.exports = router;
