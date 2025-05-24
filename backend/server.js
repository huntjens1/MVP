import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // npm install node-fetch

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DG_API_KEY = process.env.DEEPGRAM_API_KEY;

app.use(express.static('public'));
app.use(cors());
app.use(express.json());

// === Health endpoint toegevoegd ===
app.get('/api/health', (req, res) => {
  res.json({ status: "ok" });
});
// ================================

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
    // Werkt met zowel {token: "..."} als {access_token: "..."}
    res.json({ token: json.access_token || json.token });
  } catch (err) {
    console.error("[/api/deepgram-token] Internal server error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/live-transcript', (req, res) => {
  const { userId, tenantId, transcript, isFinal, ts } = req.body;
  console.log(
    `[${new Date(ts).toISOString()}] User=${userId} Tenant=${tenantId} isFinal=${isFinal}\nTranscript: ${transcript}`
  );
  res.json({ status: 'ok', received: transcript });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend draait op http://localhost:${PORT}`);
  console.log(`Frontend bereikbaar op http://localhost:${PORT}/live.html`);
});
