import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabaseClient.js';

const JWT_SECRET = process.env.JWT_SECRET || "change_this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";

function generateJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function register(req, res) {
  const { email, password, tenant_id } = req.body;
  if (!email || !password || !tenant_id) return res.status(400).json({ error: 'Missing fields' });

  const emailLower = email.trim().toLowerCase();
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', emailLower)
    .single();
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  const { data: user, error } = await supabase
    .from('users')
    .insert([{ email: emailLower, password_hash: passwordHash, tenant_id, role: 'user' }])
    .select('id, email, tenant_id, role')
    .single();
  if (error) return res.status(500).json({ error: 'Registration failed' });

  const token = generateJwt({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id });
  res.status(201).json({ token, user });
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const emailLower = email.trim().toLowerCase();
  const { data: user } = await supabase
    .from('users')
    .select('id, email, password_hash, tenant_id, role')
    .eq('email', emailLower)
    .single();
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

  const token = generateJwt({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id });
  res.json({ token, user: { id: user.id, email: user.email, tenant_id: user.tenant_id, role: user.role } });
}
