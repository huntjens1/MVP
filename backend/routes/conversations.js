import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { supabase } from '../supabaseClient.js';

const express = require('express');
const router = express.Router();

router.post('/api/conversations', requireAuth, async (req, res) => {
  const user = req.user;
  const { customer_id = null } = req.body || {};
  const { data, error } = await supabase.from('conversations').insert({
    tenant_id: user.tenant_id, agent_id: user.id, customer_id
  }).select().single();

  if (error) return res.status(500).json({ error: 'create conversation failed' });
  res.json({ conversation: data });
});

router.patch('/api/conversations/:id', requireAuth, async (req, res) => {
  const user = req.user; const { id } = req.params;
  const up = {};
  ['status','impact','urgency','itil_category','priority','transcript','sla_due'].forEach(k => {
    if (k in req.body) up[k] = req.body[k];
  });

  const { data, error } = await supabase
    .from('conversations').update(up)
    .eq('id', id).eq('tenant_id', user.tenant_id)
    .select().single();

  if (error) return res.status(500).json({ error: 'update failed' });
  res.json({ conversation: data });
});

router.post('/api/conversations/:id/close', requireAuth, async (req, res) => {
  const user = req.user; const { id } = req.params;
  const ended_at = new Date().toISOString();
  const { data: conv, error: e1 } = await supabase
    .from('conversations')
    .select('started_at').eq('id', id).eq('tenant_id', user.tenant_id).single();
  if (e1) return res.status(404).json({ error: 'not found' });

  const duration = Math.max(0, Math.round((new Date(ended_at) - new Date(conv.started_at)) / 1000));

  const { data, error } = await supabase
    .from('conversations')
    .update({ ended_at, duration_seconds: duration, status: 'afgesloten' })
    .eq('id', id).eq('tenant_id', user.tenant_id).select().single();

  if (error) return res.status(500).json({ error: 'close failed' });
  res.json({ conversation: data });
});

export default router;
module.exports = router;