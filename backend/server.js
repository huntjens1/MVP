// server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: veilig alle frontends toelaten (voor dev). Voor productie, stel origin strikter in!
app.use(cors());
app.use(express.json()); // JSON parser voor POST requests

// Simpel endpoint voor health check
app.get('/', (_, res) => {
  res.send('CallLogix live transcriptie backend actief!');
});

// Endpoint voor live transcripties vanuit de browser (direct van Deepgram)
app.post('/api/live-transcript', (req, res) => {
  const { userId, tenantId, transcript, isFinal, ts } = req.body;
  // Logging voor debug/analytics
  console.log(`[${new Date(ts).toISOString()}] User=${userId} Tenant=${tenantId} isFinal=${isFinal}\nTranscript: ${transcript}`);

  // TODO: Hier kun je opslaan in DB, AI-ITIL analyse doen, suggesties pushen etc.
  // Bijvoorbeeld (pseudo):
  // await saveTranscriptToDb({ userId, tenantId, transcript, isFinal, ts });
  // if (isFinal) { sendLiveSuggestionsToFrontend({ ... }); }

  res.json({ status: 'ok', received: transcript });
});

// (Optioneel) Static files, handig als je frontend in dezelfde app wilt serveren
// app.use(express.static('public'));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend draait op http://localhost:${PORT}`);
});
