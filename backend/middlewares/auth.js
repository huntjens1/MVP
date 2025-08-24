import express from 'express';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// Gebruik ALTIJD de public anon key voor password grant
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // zet in Railway

function msFromDuration(s) {
  const m = String(s || '15m').match(/^(\d+)([smhd])$/i);
  if (!m) return 15 * 60 * 1000;
  const n = +m[1]; const u = m[2].toLowerCase();
  return n * (u === 's' ? 1000 : u === 'm' ? 60_000 : u === 'h' ? 3_600_000 : 86_400_000);
}

const cookieOpts = {
  httpOnly: true,
  secure: true,          // prod: https enige
  sameSite: 'none',      // FE/BE verschillende origins
  path: '/',
  maxAge: msFromDuration(process.env.JWT_EXPIRES_IN || '15m'),
};

router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email en password verplicht' });
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'SUPABASE_URL of SUPABASE_ANON_KEY ontbreekt' });
    }

    // 1) Supabase password grant (met ANON key)
    const rsp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const sb = await rsp.json();
    if (!rsp.ok) {
      const msg = sb?.error_description || sb?.message || sb?.msg || 'Supabase auth failed';
      return res.status(401).json({ error: msg });
    }
    const sbUserId = sb.user?.id;
    if (!sbUserId) return res.status(401).json({ error: 'Geen user id van Supabase' });

    // 2) Haal tenant/role uit je eigen users tabel
    const { data: userRow, error } = await supabase
      .from('users')
      .select('id, tenant_id, role, email')
      .eq('id', sbUserId)
      .single();

    if (error || !userRow) {
      return res.status(403).json({ error: 'Users-record ontbreekt voor deze account' });
    }

    // 3) Zet eigen JWT in HttpOnly cookie
    const token = jwt.sign(
      { uid: userRow.id, tenant_id: userRow.tenant_id, role: userRow.role || 'support' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    );
    res.cookie('auth', token, cookieOpts);

    return res.json({
      ok: true,
      user: {
        id: userRow.id,
        email: userRow.email,
        tenant_id: userRow.tenant_id,
        role: userRow.role || 'support',
      },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/api/logout', (_req, res) => {
  res.clearCookie('auth', { path: '/' });
  return res.json({ ok: true });
});

router.get('/api/me', (req, res) => {
  try {
    const raw = req.cookies?.auth || '';
    if (!raw) return res.json({ authenticated: false });
    const payload = jwt.verify(raw, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return res.json({
      authenticated: true,
      user: { id: payload.uid, tenant_id: payload.tenant_id, role: payload.role || 'support' },
    });
  } catch {
    return res.json({ authenticated: false });
  }
});

export default router;
