import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabaseClient.js';
import { Resend } from 'resend';

const JWT_SECRET = process.env.JWT_SECRET || "change_this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const resend = new Resend(process.env.RESEND_API_KEY);

function generateJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Login endpoint
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

// Gebruiker uitnodigen met mail via Resend
export async function inviteUser(req, res) {
  try {
    const { email, password, tenant_id, role } = req.body;

    if (!email || !password || !tenant_id || !role) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const emailLower = email.trim().toLowerCase();

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

    // Genereer bcrypt hash
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Voeg toe aan users-tabel
    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          email: emailLower,
          password_hash: passwordHash,
          tenant_id,
          role,
        },
      ])
      .select('id, email, tenant_id, role')
      .single();

    if (error) return res.status(500).json({ error: 'Toevoegen mislukt' });

    // Verstuur invite e-mail met Resend
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM || 'noreply@resend.dev',
        to: [emailLower],
        subject: "Uitnodiging voor CallLogix",
        text: `Hallo,

Je bent uitgenodigd voor CallLogix. Je kunt nu inloggen op https://calllogix.nl/auth

Inloggegevens:
E-mail: ${emailLower}
Tijdelijk wachtwoord: ${password}

Je wordt gevraagd het wachtwoord te wijzigen na inloggen.

Met vriendelijke groet,
Het CallLogix team
        `,
      });
    } catch (mailErr) {
      // User wordt toegevoegd, maar mailen is mislukt:
      console.error("Resend mail error:", mailErr);
      return res.status(201).json({
        message: 'Gebruiker aangemaakt, maar versturen e-mail is mislukt.',
        user,
        mailError: mailErr.message,
      });
    }

    return res.status(201).json({ message: 'Gebruiker aangemaakt en invite verzonden', user });
  } catch (err) {
    console.error("[inviteUser] Internal server error:", err);
    res.status(500).json({ error: 'Internal server error', details: err.message || err });
  }
}
