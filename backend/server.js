import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('public'));

app.get('/', (_, res) => res.send('Deepgram live backend online! '));

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const PORT = process.env.PORT || 3001;

if (!DEEPGRAM_API_KEY) {
  console.error('❌ Deepgram API key ontbreekt! ');
  process.exit(1);
}

console.log('Initializing Deepgram client...');
const deepgram = createClient(DEEPGRAM_API_KEY);
console.log('✅ Deepgram client initialized');

io.on('connection', (socket) => {
  console.log('🟢 Nieuwe Socket.io client verbonden');
  let dgConnection = null;
  let keepAliveInterval = null;

  try {
    // Deepgram live verbinding
    console.log('🔄 Attempting to create Deepgram connection...');
    dgConnection = deepgram.listen.live({
      model: "general",
      language: "nl",
      smart_format: true,
      interim_results: true,
      endpointing: true,
      punctuate: true
    });
    console.log('✅ Deepgram connection object created');

    dgConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('🎙️ Deepgram connection SUCCESSFULLY opened');
      socket.emit('status', { status: 'connected', message: 'Deepgram verbinding actief' });
      try {
        // Stiltebuffer sturen
        const silentBuffer = Buffer.from(new Uint8Array(8));
        dgConnection.send(silentBuffer);
        console.log('📣 Sent initial silent audio data to Deepgram');
      } catch (err) {
        console.error('❌ Error sending initial audio data:', err);
      }
      keepAliveInterval = setInterval(() => {
        if (dgConnection && dgConnection.getReadyState() === 1) {
          try {
            console.log('📢 Sending KeepAlive to Deepgram');
            dgConnection.send({ type: "KeepAlive" });
          } catch (err) {
            console.error('❌ Error sending keepAlive:', err);
          }
        }
      }, 5000);
    });

    dgConnection.on(LiveTranscriptionEvents.Transcript, (transcript) => {
      console.log('📝 Received transcript from Deepgram:', 
        JSON.stringify(transcript).substring(0, 200) + 
        (JSON.stringify(transcript).length > 200 ? '...' : ''));
      socket.emit('transcript', transcript);
    });

    dgConnection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
      console.log('📋 Received metadata from Deepgram:', metadata);
    });

    dgConnection.on(LiveTranscriptionEvents.UtteranceEnd, (utterance) => {
      console.log('🔚 Utterance end event received:', utterance);
    });

    dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('❌ Deepgram error:', error);
      try {
        console.error('Error details:', JSON.stringify(error));
      } catch (e) {
        console.error('Error object not stringifiable:', error);
      }
      socket.emit('error', { 
        message: 'Fout in Deepgram verbinding', 
        details: error.message || 'Onbekende fout' 
      });
    });

    dgConnection.on(LiveTranscriptionEvents.Close, (closeEvent) => {
      console.log('🔴 Deepgram verbinding gesloten', closeEvent);

      let closeMessage = '';
      if (closeEvent && closeEvent._closeMessage) {
        try {
          closeMessage = closeEvent._closeMessage.toString('utf8');
          console.log('Close message:', closeMessage);
        } catch (err) {
          console.error('Error decoding close message:', err);
        }
      }

      socket.emit('status', { 
        status: 'disconnected', 
        message: 'Deepgram verbinding gesloten',
        details: closeMessage
      });

      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    });

    // VERBETERDE DEBUG: extra logging en type checks
    socket.on('audioData', (data) => {
      // Diepe inspectie van binnenkomende audio
      console.log('--------------------------------------');
      console.log(`📣 Received audio data from client: ${data.byteLength || data.length || 'unknown'} bytes`);
      console.log('Type van binnengekomen data:', typeof data);
      console.log('Is Buffer:', Buffer.isBuffer(data));
      if (Buffer.isBuffer(data)) {
        console.log('Eerste bytes:', data.slice(0, 8));
      } else {
        console.log('LET OP: data is GEEN Buffer. Wellicht verkeerd geïnterpreteerd door socket.io.');
      }

      // Stuur naar Deepgram als verbinding open is
      if (dgConnection && dgConnection.getReadyState() === 1) {
        try {
          console.log('✅ Sending audio data to Deepgram');
          dgConnection.send(data);
        } catch (err) {
          console.error('❌ Error sending audio to Deepgram:', err);
          socket.emit('error', { message: 'Fout bij verzenden audio', details: err.message });
        }
      } else {
        console.warn(`⚠️ Cannot send audio: Deepgram connection not open (state: ${dgConnection ? dgConnection.getReadyState() : 'null'})`);
      }
    });

    socket.on('testTranscript', () => {
      console.log('🧪 Test transcript requested');
      socket.emit('transcript', {
        is_final: true,
        channel: {
          alternatives: [
            {
              transcript: 'Dit is een test van de transcriptie functionaliteit van de server.'
            }
          ]
        }
      });
    });

    socket.emit('connectionStatus', { connected: true });

    socket.on('disconnect', () => {
      console.log('🔴 Socket.io client ontkoppeld');
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      if (dgConnection) {
        try {
          dgConnection.send({ type: 'CloseStream' });
          console.log('✅ CloseStream sent to Deepgram');
        } catch (err) {
          console.error('❌ Error sending CloseStream to Deepgram:', err);
        }
      }
    });

    socket.on('stopTranscription', () => {
      console.log('🛑 Client requested to stop transcription');
      if (dgConnection) {
        try {
          dgConnection.send({ type: 'CloseStream' });
          console.log('✅ CloseStream sent to Deepgram');
        } catch (err) {
          console.error('❌ Error sending CloseStream to Deepgram:', err);
        }
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
      }
    });

  } catch (error) {
    console.error('❌ Fout bij opzetten Deepgram verbinding:', error);
    socket.emit('error', { 
      message: 'Kon geen verbinding maken met Deepgram', 
      details: error.message || 'Onbekende fout' 
    });
  }
});

// Start de server
server.listen(PORT, () => {
  console.log(`🚀 Server draait op poort ${PORT}`);
});
