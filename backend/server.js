import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS enabled
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Statische files (zoals test.html)
app.use(cors());
app.use(express.static('public'));

app.get('/', (_, res) => res.send('Deepgram live backend online! '));

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const PORT = process.env.PORT || 3001;

if (!DEEPGRAM_API_KEY) {
  console.error('❌ Deepgram API key ontbreekt! ');
  process.exit(1);
}

// Log the SDK version for debugging
try {
  console.log('Deepgram SDK version check...');
  const dgPackage = require('@deepgram/sdk/package.json');
  console.log(`Using Deepgram SDK version: ${dgPackage.version}`);
} catch (err) {
  console.log('Could not determine Deepgram SDK version');
}

// Initialize Deepgram with the v4 method
console.log('Initializing Deepgram client...');
const deepgram = createClient(DEEPGRAM_API_KEY);
console.log('✅ Deepgram client initialized');

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('🟢 Nieuwe Socket.io client verbonden');
  let dgConnection = null;
  let keepAliveInterval = null;

  try {
    // Create a live transcription connection with v4 syntax and audio format parameters
    console.log('🔄 Attempting to create Deepgram connection...');
    dgConnection = deepgram.listen.live({
      model: 'nova-2',
      language: 'nl',
      smart_format: true,
      interim_results: true,
      vad: true,               // Enable voice activity detection
      encoding: 'audio/webm',  // Specify the audio format being sent
      sample_rate: 48000,      // Common sample rate for browser audio
      channels: 1              // Mono audio
    });
    console.log('✅ Deepgram connection object created');
    
    // Handle connection open event
    dgConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('🎙️ Deepgram connection SUCCESSFULLY opened');
      socket.emit('status', { status: 'connected', message: 'Deepgram verbinding actief' });
      
      // Set up KeepAlive to prevent timeouts
      keepAliveInterval = setInterval(() => {
        if (dgConnection && dgConnection.getReadyState() === 1) { // 1 = OPEN
          try {
            console.log('📢 Sending KeepAlive to Deepgram');
            dgConnection.send({ type: "KeepAlive" });
          } catch (err) {
            console.error('❌ Error sending keepAlive:', err);
          }
        }
      }, 5000);
    });

    // Handle transcription results from Deepgram
    dgConnection.on(LiveTranscriptionEvents.Transcript, (transcript) => {
      console.log('📝 Received transcript from Deepgram:', 
                 JSON.stringify(transcript).substring(0, 200) + '...');
      
      // Forward the complete transcript data to the client
      socket.emit('transcript', transcript);
    });

    // Handle metadata events from Deepgram (for debugging)
    dgConnection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
      console.log('📋 Received metadata from Deepgram:', metadata);
    });

    // Handle utterance end events (for debugging)
    dgConnection.on(LiveTranscriptionEvents.UtteranceEnd, (utterance) => {
      console.log('🔚 Utterance end event received:', utterance);
    });

    // Handle Deepgram errors
    dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('❌ Deepgram error:', error);
      console.error('Error details:', JSON.stringify(error));
      socket.emit('error', { 
        message: 'Fout in Deepgram verbinding', 
        details: error.message || 'Onbekende fout' 
      });
    });

    // Handle Deepgram connection close
    dgConnection.on(LiveTranscriptionEvents.Close, () => {
      console.log('🔴 Deepgram verbinding gesloten');
      socket.emit('status', { status: 'disconnected', message: 'Deepgram verbinding gesloten' });
      
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    });

    // Handle audio data from client
    socket.on('audioData', (data) => {
      console.log(`📣 Received audio data from client: ${data.byteLength || data.length || 'unknown'} bytes`);
      
      if (dgConnection && dgConnection.getReadyState() === 1) { // 1 = OPEN
        try {
          // Confirm the connection is actually open
          console.log('✅ Deepgram connection is open, sending audio');
          dgConnection.send(data);
        } catch (err) {
          console.error('❌ Error sending audio to Deepgram:', err);
        }
      } else {
        console.warn(`⚠️ Cannot send audio: Deepgram connection not open (state: ${dgConnection ? dgConnection.getReadyState() : 'null'})`);
      }
    });

    // Handle test transcript (for troubleshooting)
    socket.on('testTranscript', () => {
      console.log('🧪 Test transcript requested');
      
      // Send a test transcript to verify client handling works
      const testTranscript = {
        is_final: true,
        channel: {
          alternatives: [
            {
              transcript: 'Dit is een test van de transcriptie functionaliteit.'
            }
          ]
        }
      };
      
      socket.emit('transcript', testTranscript);
    });

    // Handle client disconnect
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

    // Handle client requesting to stop transcription
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

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Server draait op poort ${PORT}`);
});
