import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import suggestQuestionRouter from './routes/suggestQuestion.js';
import authRouter from './routes/auth.js';
import aiFeedbackRouter from './routes/aiFeedback.js';
import summarizeRoute from "./routes/summarize.js";
import analyticsRouter from './routes/analytics.js';
import transcriptsRouter from "./routes/transcripts.js";
import conversationsRouter from "./routes/conversations.js";
import { requireAuth } from './middlewares/auth.js';
import { requireRole } from './middlewares/requireRole.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DG_API_KEY = process.env.DEEPGRAM_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.json());
app.use(cors({
  origin: [
    "https://mvp-zeta-rose.vercel.app",
    "http://localhost:5173"
  ],
  credentials: true
}));
app.use(express.static('public'));
app.use(authRouter);
app.use(suggestQuestionRouter);
app.use(aiFeedbackRouter);
app.use(summarizeRoute);
app.use(analyticsRouter);
app.use(transcriptsRouter);
app.use(conversationsRouter);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: "ok" });
});

// Deepgram token
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
        body: JSON.stringify({ scopes: ["listen:stream"] }),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: `Deepgram error: ${text}` });
    }
    const json = await response.json();
    res.json({ token: json.access_token || json.token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live transcript
app.post('/api/live-transcript', (req, res) => {
  const { userId, tenantId, transcript, isFinal, ts } = req.body;
  res.json({ status: 'ok', received: transcript });
});

// Invite user (alleen manager en superadmin)
app.post('/api/invite-user',
  requireAuth,
  requireRole(["manager", "superadmin"]),
  async (req, res) => {
    const { email, role, tenant_id } = req.body;
    if (!email || !role || !tenant_id) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("email", email)
      .eq("tenant_id", tenant_id)
      .single();
    if (existingUser) {
      return res.status(400).json({ error: "Gebruiker is al gekoppeld aan deze tenant" });
    }
    const { data: usersList } = await supabase.auth.admin.listUsers({ email });
    let authId;
    if (usersList && usersList.users && usersList.users.length > 0) {
      authId = usersList.users[0].id;
      const { error: userError } = await supabase
        .from("users")
        .insert([{ id: authId, email, role, tenant_id }]);
      if (userError) return res.status(400).json({ error: userError.message });
      return res.status(200).json({ success: true, info: "Gebruiker gekoppeld aan tenant" });
    } else {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: false,
        password: crypto.randomUUID(),
      });
      if (authError) return res.status(400).json({ error: authError.message });
      const { error: userError } = await supabase
        .from("users")
        .insert([{ id: authUser.user.id, email, role, tenant_id }]);
      if (userError) return res.status(400).json({ error: userError.message });
      return res.status(200).json({ success: true, info: "Invite verstuurd, user toegevoegd" });
    }
  }
);

// Tenants (alleen superadmin)
app.get("/api/tenants",
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

// Users (manager, superadmin; alleen eigen tenant tenzij superadmin)
app.get("/api/users",
  requireAuth,
  requireRole(["manager", "superadmin"], { onlyOwnTenant: true }),
  async (req, res) => {
    let query = supabase.from("users").select("id, email, role, tenant_id, created_at");
    if (req.user.role !== "superadmin") {
      query = query.eq("tenant_id", req.user.tenant_id);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ users: data });
  }
);

// AI feedback posten (support, manager, superadmin, alleen eigen tenant)
app.post("/api/ai-feedback",
  requireAuth,
  requireRole(["support", "manager", "superadmin"], { onlyOwnTenant: true }),
  async (req, res) => {
    const { suggestion_id, suggestion_text, conversation_id, user_id, feedback, tenant_id } = req.body;
    if (tenant_id !== req.user.tenant_id && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden: wrong tenant" });
    }
    const { error } = await supabase
      .from("ai_suggestion_feedback")
      .insert([{ suggestion_id, suggestion_text, conversation_id, user_id, feedback, tenant_id }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  }
);

// Server starten
app.listen(PORT, () => {
  console.log(`🚀 Backend draait op http://localhost:${PORT}`);
});
