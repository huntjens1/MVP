import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { supabase } from '../supabaseClient.js';

const express = require('express');
const router = express.Router();

router.post('/api/transcripts/ingest', requireAuth, async (req, res) => {
  const user = req.user;
  const { conversation_id, content, is_final = false, speaker_label = null, speaker = null } = req.body || {};
  if (!conversation_id || !content) return res.status(400).json({ error: 'conversation_id en content zijn vereist' });

  const { error } = await supabase
    .from('transcripts')
    .insert({ conversation_id, tenant_id: user.tenant_id, content, is_final, speaker_label, speaker });

  if (error) return res.status(500).json({ error: 'insert transcript mislukt' });
  return res.json({ ok: true });
});
module.exports = router;
export default router;
