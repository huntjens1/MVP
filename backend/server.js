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
    // Create a live transcription connection with v4 syntax
    // NOTE: We're simplifying the parameters to fix the 400 error
    console.log('🔄 Attempting to create Deepgram connection...');
    dgConnection = deepgram.listen.live({
      model: 'nova-2',
      language: 'nl',
      smart_format: true,
      interim_results: true
      // Removed potentially problematic parameters
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
      console.log('📝 Received transcript from Deepgram');
      
      // Forward the transcript data to the client
      socket.emit('transcript', transcript);
    });

    // Handle Deepgram errors with more detailed logging
    dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('❌ Deepgram error:', error);
      // Log full error details for debugging
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

    // Handle Deepgram connection close
    dgConnection.on(LiveTranscriptionEvents.Close, (closeEvent) => {
      console.log('🔴 Deepgram verbinding gesloten', closeEvent);
      socket.emit('status', { status: 'disconnected', message: 'Deepgram verbinding gesloten' });
      
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    });

    // Handle audio data from client - special handling for binary data
    socket.on('audioData', (data) => {
      if (dgConnection && dgConnection.getReadyState() === 1) { // 1 = OPEN
        try {
          // Send the audio data directly without modification
          dgConnection.send(data);
        } catch (err) {
          console.error('❌ Error sending audio to Deepgram:', err);
          socket.emit('error', { message: 'Fout bij verzenden audio', details: err.message });
        }
      }
    });

    // Add test transcript feature
    socket.on('testTranscript', () => {
      console.log('🧪 Test transcript requested');
      socket.emit('transcript', {
        is_final: true,
        channel: {
          alternatives: [
            {
              transcript: 'Dit is een test van de transcriptie functionaliteit.'
            }
          ]
        }
      });
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
