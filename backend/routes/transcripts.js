const express = require('express');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

const mem = new Map(); // conversation_id -> [{role,text,ts},...]

router.get('/transcripts', requireAuth, (req, res) => {
  const { conversation_id } = req.query;
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });
  res.json({ conversation_id, messages: mem.get(conversation_id) || [] });
});

router.post('/transcripts', requireAuth, (req, res) => {
  const { conversation_id, role, text, ts } = req.body || {};
  if (!conversation_id || !text) return res.status(400).json({ error: 'conversation_id and text are required' });
  const arr = mem.get(conversation_id) || [];
  arr.push({ role: role || 'client', text, ts: ts || Date.now() });
  mem.set(conversation_id, arr);
  res.json({ ok: true });
});

module.exports = router;
