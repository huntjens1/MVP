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

// Nieuwe endpoint: /api/deepgram-token gebruikt nu /v1/token (niet meer project-id nodig)
app.post('/api/deepgram-token', async (req, res) => {
  try {
    const response = await fetch(
      `https://api.deepgram.com/v1/token`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DG_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scopes: ["listen:stream"],
          // expires_in: 1800 // (optioneel: geldigheid in seconden)
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Deepgram API error response:", text);
      return res.status(500).json({ error: `Deepgram error: ${text}` });
    }

    const { token } = await response.json();
    res.json({ token });
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
