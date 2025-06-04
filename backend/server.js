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

// ===== CORS Middleware - altijd bovenaan vóór routes! =====
app.use(cors({
  origin: [
    "https://mvp-zeta-rose.vercel.app", // <-- jouw frontend live url
    "http://localhost:5173"             // <-- voor lokaal testen
  ],
  credentials: true
}));
app.use(express.json());

// ====== Static files ======
app.use(express.static('public'));

// ====== Routers ======
app.use(authRouter);
app.use(suggestQuestionRouter);
app.use(aiFeedbackRouter);
app.use(summarizeRoute);
app.use(analyticsRouter);
app.use(transcriptsRouter);
app.use(conversationsRouter);

// ===== Health endpoint =====
app.get('/api/health', (req, res) => {
  res.json({ status: "ok" });
});

// ===== Deepgram token endpoint =====
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

// ===== Live transcript endpoint (optioneel, debugging/logging) =====
app.post('/api/live-transcript', (req, res) => {
  const { userId, tenantId, transcript, isFinal, ts } = req.body;
  res.json({ status: 'ok', received: transcript });
});

// ===== Server starten =====
app.listen(PORT, () => {
  console.log(`🚀 Backend draait op http://localhost:${PORT}`);
});
