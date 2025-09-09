import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { supabase } from '../supabaseClient.js';

const express = require('express');
const router = express.Router();

router.get('/api/analytics/overview', requireAuth, async (req, res) => {
  const user = req.user;

  const { data: convs, error: e1 } = await supabase
    .from('conversations')
    .select('duration_seconds')
    .eq('tenant_id', user.tenant_id)
    .not('duration_seconds', 'is', null);

  if (e1) return res.status(500).json({ error: 'analytics failed' });

  const aht = convs.length
    ? Math.round(convs.reduce((s,c)=>s+(c.duration_seconds||0),0)/convs.length)
    : 0;

  const { data: fb, error: e2 } = await supabase
    .from('ai_suggestion_feedback')
    .select('feedback')
    .eq('tenant_id', user.tenant_id);

  const pos = fb?.filter(x=>x.feedback===1).length || 0;
  const total = fb?.length || 0;
  const suggest_accept = total ? Math.round((pos/total)*100) : 0;

  return res.json({ aht_seconds: aht, suggestion_positive_pct: suggest_accept });
});

export default router;
module.exports = router;