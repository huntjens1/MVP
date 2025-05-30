import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabaseClient.js';
import { sendMail } from '../utils/mailer.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || "change_this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export async function inviteUser(req, res) {
  try {
    const { email, tenant_id, role } = req.body;

    if (!email || !tenant_id || !role) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const emailLower = email.trim().toLowerCase();
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 uur geldig

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
      .insert([
        {
          email: emailLower,
          tenant_id,
          role,
          invite_token: inviteToken,
          invite_expires: inviteExpires.toISOString(),
        },
      ])
      .select('id, email, tenant_id, role, invite_token')
      .single();

    if (error) return res.status(500).json({ error: "Toevoegen mislukt" });

    // Bouw invite-link (frontend url)
    const inviteLink = `${FRONTEND_URL}/set-password?token=${inviteToken}&email=${encodeURIComponent(emailLower)}`;

    // Stuur invite-mail via Nodemailer
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
    console.error("INVITE ERROR:", err);  // <-- Dit logt alle errors!
    res.status(500).json({ error: "Internal server error" });
  }
}
