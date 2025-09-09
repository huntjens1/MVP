// backend/routes/transcripts.js (CommonJS)
const express = require('express');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Heel eenvoudige in-memory opslag van transcriptregels per conversation_id.
// Vervang later door DB/Supabase.
const store = new Map();

/**
 * GET /api/transcripts?conversation_id=...
 * Haal transcriptregels op (MVP)
 */
router.get('/api/transcripts', requireAuth, async (req, res) => {
  const cid = req.query?.conversation_id;
  if (!cid) return res.status(400).json({ error: 'conversation_id_required' });
  const lines = store.get(cid) || [];
  return res.json({ items: lines });
});

/**
 * POST /api/transcripts
 * Voeg een transcriptregel toe (optioneel, handig voor tests / tooling)
 * body: { conversation_id, speaker, content, ts }
 */
router.post('/api/transcripts', requireAuth, async (req, res) => {
  const { conversation_id, speaker = 'unknown', content = '', ts = Date.now() } = req.body || {};
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id_required' });

  const line = { speaker, content, ts };
  const arr = store.get(conversation_id) || [];
  arr.push(line);
  store.set(conversation_id, arr);
  return res.status(201).json({ item: line });
});

module.exports = router;
