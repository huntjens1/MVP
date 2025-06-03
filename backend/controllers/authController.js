import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabaseClient.js';
import { sendMail } from '../utils/mailer.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || "change_this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// =================== LOGIN ===================
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const emailLower = email.trim().toLowerCase();

    const { data: user } = await supabase
      .from('users')
      .select('id, email, password_hash, tenant_id, role')
      .eq('email', emailLower)
      .single();

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        tenant_id: user.tenant_id,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =================== INVITE USER ===================
export async function inviteUser(req, res) {
  try {
    const { email, tenant_id, role } = req.body;
    if (!email || !tenant_id || !role) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const emailLower = email.trim().toLowerCase();
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 uur

    // Check of user al bestaat
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailLower)
      .eq('tenant_id', tenant_id)
      .single();
    if (existing) {
      return res.status(409).json({ error: 'Gebruiker bestaat al' });
    }

    // Voeg user toe met invite_token
    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        email: emailLower,
        tenant_id,
        role,
        invite_token: inviteToken,
        invite_expires: inviteExpires.toISOString(),
      }])
      .select('id, email, tenant_id, role, invite_token')
      .single();

    if (error) return res.status(500).json({ error: "Toevoegen mislukt" });

    // Bouw invite-link
    const inviteLink = `${FRONTEND_URL}/set-password?token=${inviteToken}&email=${encodeURIComponent(emailLower)}`;

    // Stuur invite-mail
    await sendMail({
      to: emailLower,
      subject: "Je CallLogix account is aangemaakt",
      html: `<h1>Welkom bij CallLogix!</h1>
        <p>Klik <a href="${inviteLink}">hier</a> om je wachtwoord in te stellen.</p>
        <p>Of kopieer deze link: ${inviteLink}</p>`,
      text: `Welkom bij CallLogix! Stel je wachtwoord in via: ${inviteLink}`,
    });

    return res.status(201).json({ message: "Gebruiker uitgenodigd", user });
  } catch (err) {
    console.error("INVITE ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// =================== SET PASSWORD ===================
export async function setPassword(req, res) {
  try {
    const { email, token, password } = req.body;
    const now = new Date();

    // Zoek user met correcte invite_token
    const { data: user } = await supabase
      .from("users")
      .select("id, invite_token, invite_expires")
      .eq("email", email.trim().toLowerCase())
      .eq("invite_token", token)
      .single();

    if (!user || !user.invite_expires || new Date(user.invite_expires) < now) {
      return res.status(400).json({ error: "Invite-token ongeldig of verlopen." });
    }

    // Hash wachtwoord
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Update user: wachtwoord instellen, invite_token wissen
    const { error: updateError } = await supabase
      .from("users")
      .update({
        password_hash: passwordHash,
        invite_token: null,
        invite_expires: null,
      })
      .eq("id", user.id);

    if (updateError) {
      return res.status(500).json({ error: "Wachtwoord opslaan mislukt" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("SET PASSWORD ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
