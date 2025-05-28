import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabaseClient.js';

const JWT_SECRET = process.env.JWT_SECRET || "change_this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";

function generateJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const emailLower = email.trim().toLowerCase();

    // --- DEBUG LOGGING ---
    console.log("=== LOGIN ATTEMPT ===");
    console.log("Frontend email:", email);
    console.log("Lowercased:", emailLower);

    // Zoek user in db
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, tenant_id, role')
      .eq('email', emailLower)
      .single();

    // --- DEBUG LOGGING ---
    console.log("User found in db:", user);
    if (error) console.log("DB error:", error);

    if (!user) {
      console.log("User not found in db!");
      return res.status(401).json({ error: 'Invalid credentials (not found)' });
    }
    if (!user.password_hash) {
      console.log("User gevonden, maar geen password_hash!");
      return res.status(401).json({ error: 'Invalid credentials (geen hash)' });
    }
    // bcrypt vergelijking
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log("Wachtwoord uit frontend:", password);
    console.log("Hash uit db:", user.password_hash);
    console.log("bcrypt.match:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials (hash mismatch)' });
    }

    const token = generateJwt({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id });
    console.log("=== LOGIN SUCCESS === User:", user.email);
    res.json({ token, user: { id: user.id, email: user.email, tenant_id: user.tenant_id, role: user.role } });
  } catch (err) {
    console.log("Login error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
