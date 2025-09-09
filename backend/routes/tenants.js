import express from 'express';
import { supabase } from '../supabaseClient.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';

const express = require('express');
const router = express.Router();

router.get('/api/tenants',
  requireAuth,
  requireRole(["superadmin"]),
  async (req, res) => {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, domain, created_at");
    if (error) return res.status(500).json({ error: error.message });
    res.json({ tenants: data });
  }
);

// **Dit is de enige juiste export voor ESM/Express!**
export default router;
module.exports = router;