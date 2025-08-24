import express from 'express';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch'; // node18+ heeft global fetch; laat staan voor compat
import { supabase } from '../supabaseClient.js';

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY; // zet 1 van beiden in .env

function cookieOpts() {
  return {
    httpOnly: true,
    secure: true,           // vereist op https (prod)
    sameSite: 'none',       // FE en BE op verschillende origins
    path: '/',
    maxAge: parseJwtExpiry(process.env.JWT_EXPIRES_IN || '15m') // in ms
  };
}

function parseJwtExpiry(s) {
  // '15m' | '1h' | '7d'
  const m = String(s).match(/^(\d+)([smhd])$/i);
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  return n * (unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000);
}

router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email en password verplicht' });
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'Supabase env ontbreekt' });
    }

    // 1) Supabase password grant
    const rsp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ email, password })
    });

    const sb = await rsp.json();
    if (!rsp.ok) {
      return res.status(401).json({ error: sb?.error_description || sb?.message || 'Login mislukt' });
    }

    const sbUserId = sb.user?.id;
    if (!sbUserId) return res.status(401).json({ error: 'Login mislukt' });

    // 2) Lookup jouw user record (tenant_id, role) — service role OK voor server
    const { data: userRow, error } = await supabase
      .from('users')
      .select('id, tenant_id, role, email')
      .eq('id', sbUserId)
      .single();

    if (error || !userRow) {
      return res.status(403).json({ error: 'Geen toegangsprofiel (users record ontbreekt)' });
    }

    const token = jwt.sign(
      { uid: userRow.id, tenant_id: userRow.tenant_id, role: userRow.role || 'support' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    res.cookie('auth', token, cookieOpts());
    return res.json({
      ok: true,
      user: { id: userRow.id, email: userRow.email, tenant_id: userRow.tenant_id, role: userRow.role || 'support' }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/api/logout', async (_req, res) => {
  res.clearCookie('auth', { path: '/' });
  return res.json({ ok: true });
});

router.get('/api/me', async (req, res) => {
  try {
    const raw = req.cookies?.auth || '';
    if (!raw) return res.status(200).json({ authenticated: false });
    const payload = jwt.verify(raw, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return res.json({ authenticated: true, user: { id: payload.uid, tenant_id: payload.tenant_id, role: payload.role || 'support' } });
  } catch {
    return res.status(200).json({ authenticated: false });
  }
});

export default router;
