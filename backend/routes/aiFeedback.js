import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

router.post('/api/ai-feedback', requireAuth, async (req, res) => {
  const user = req.user;
  const { suggestion_id, conversation_id, feedback, suggestion_text } = req.body || {};
  if (!conversation_id || typeof feedback === 'undefined') {
    return res.status(400).json({ error: 'conversation_id en feedback vereist' });
  }

  const { error } = await supabase
    .from('ai_suggestion_feedback')
    .insert({
      suggestion_id: suggestion_id || null,
      conversation_id,
      user_id: user.id,
      feedback,           // -1 / 0 / 1
      suggestion_text: suggestion_text || null,
      tenant_id: user.tenant_id
    });

  if (error) return res.status(500).json({ error: 'feedback insert mislukt' });
  return res.json({ ok: true });
});

export default router;
