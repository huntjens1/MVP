import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // npm install node-fetch
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DG_API_KEY = process.env.DEEPGRAM_API_KEY;

// Supabase client (let op: gebruik altijd service role key in backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.static('public'));
app.use(cors());
app.use(express.json());

// === Health endpoint ===
app.get('/api/health', (req, res) => {
  res.json({ status: "ok" });
});

// === Deepgram token endpoint ===
app.post('/api/deepgram-token', async (req, res) => {
  try {
    const response = await fetch(
      `https://api.deepgram.com/v1/auth/grant`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DG_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scopes: ["listen:stream"],
          // expires_in: 1800 // optioneel: aantal seconden geldig (max 3600)
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Deepgram API error response:", text);
      return res.status(500).json({ error: `Deepgram error: ${text}` });
    }

    const json = await response.json();
    res.json({ token: json.access_token || json.token });
  } catch (err) {
    console.error("[/api/deepgram-token] Internal server error:", err);
    res.status(500).json({ error: err.message });
  }
});

// === Live transcript endpoint ===
app.post('/api/live-transcript', (req, res) => {
  const { userId, tenantId, transcript, isFinal, ts } = req.body;
  console.log(
    `[${new Date(ts).toISOString()}] User=${userId} Tenant=${tenantId} isFinal=${isFinal}\nTranscript: ${transcript}`
  );
  res.json({ status: 'ok', received: transcript });
});

// === Invite-user endpoint ===
app.post('/api/invite-user', async (req, res) => {
  const { email, role, tenant_id } = req.body;

  if (!email || !role || !tenant_id) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // 1. Maak een Auth user aan in Supabase
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: false,
    password: crypto.randomUUID(),
  });
  if (authError) return res.status(400).json({ error: authError.message });

  // 2. Voeg toe aan users-tabel met exact dezelfde id
  const { error: userError } = await supabase
    .from("users")
    .insert([
      {
        id: authUser.user.id,
        email,
        role,
        tenant_id,
      },
    ]);
  if (userError) return res.status(400).json({ error: userError.message });

  return res.status(200).json({ success: true });
});

// === Server starten ===
app.listen(PORT, () => {
  console.log(`🚀 Backend draait op http://localhost:${PORT}`);
  console.log(`Frontend bereikbaar op http://localhost:${PORT}/live.html`);
});
