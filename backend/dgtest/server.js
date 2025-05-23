import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws'; // ALLEEN deze import werkt in ESM!
import { Deepgram } from '@deepgram/sdk';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Statische files (zoals test.html)
app.use(cors());
app.use(express.static('public'));

app.get('/', (_, res) => res.send('Deepgram live backend online!'));

const wss = new WebSocketServer({ server, path: '/live' });

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const PORT = process.env.PORT || 3001;

if (!DEEPGRAM_API_KEY) {
  console.error('❌ Deepgram API key ontbreekt!');
  process.exit(1);
}

wss.on('connection', async (wsClient) => {
  console.log('🟢 Nieuwe WebSocket client verbonden');
  let dgStream;

  try {
    // Deepgram V4: class constructor, alleen ondersteunde opties
    const deepgram = new Deepgram(DEEPGRAM_API_KEY);

    dgStream = await deepgram.transcription.live({
      language: 'nl',             // mag ook 'en-US', 'en', etc.
      encoding: 'oggopus',        // expliciet volgens docs
      sample_rate: 48000,         // verplicht bij oggopus (docs)
      punctuate: true,            // optioneel
      interim_results: true,      // optioneel
    });

    // Alleen v4 events!
    dgStream.addListener('open', () => {
      console.log('🔵 Deepgram stream geopend');
    });

    dgStream.addListener('transcriptReceived', (data) => {
      const transcript = data.channel?.alternatives[0]?.transcript;
      if (typeof transcript === 'string' && transcript.trim()) {
        wsClient.send(JSON.stringify({ transcript }));
        console.log('📝 Transcript:', transcript);
      }
    });

    dgStream.addListener('error', (err) => {
      console.error('❌ Deepgram fout:', err);
      wsClient.send(JSON.stringify({ error: err.message }));
    });

    dgStream.addListener('close', () => {
      console.log('🔴 Deepgram stream gesloten');
    });

    // WebSocket message (binary audio) doorsturen naar Deepgram
    wsClient.on('message', (chunk) => {
      if (dgStream) dgStream.send(chunk);
    });

    wsClient.on('close', () => {
      if (dgStream) dgStream.finish();
      console.log('⚪ WebSocket client gesloten, Deepgram sessie afgesloten');
    });

    wsClient.on('error', (err) => {
      console.error('❌ WebSocket client fout:', err);
    });

  } catch (err) {
    console.error('❌ Deepgram setup fout:', err);
    wsClient.send(JSON.stringify({ error: err.message }));
    wsClient.close();
    if (dgStream) dgStream.finish();
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Backend live op http://localhost:${PORT}`);
});
