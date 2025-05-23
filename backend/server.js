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
    console.log('🔄 Attempting to create Deepgram connection...');
    dgConnection = deepgram.listen.live({
      model: "general",  // Using general model instead of nova-2 for better recognition
      language: "nl",
      smart_format: true,
      interim_results: true,
      endpointing: true,
      punctuate: true
    });
    console.log('✅ Deepgram connection object created');
    
    // Handle connection open event
    dgConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('🎙️ Deepgram connection SUCCESSFULLY opened');
      socket.emit('status', { status: 'connected', message: 'Deepgram verbinding actief' });
      
      // Send initial audio data to prevent timeout
      try {
        // Create a small silent audio buffer (8 bytes of zeros)
        const silentBuffer = Buffer.from(new Uint8Array(8));
        dgConnection.send(silentBuffer);
        console.log('📣 Sent initial silent audio data to Deepgram');
      } catch (err) {
        console.error('❌ Error sending initial audio data:', err);
      }
      
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
                 JSON.stringify(transcript).substring(0, 200) + 
                 (JSON.stringify(transcript).length > 200 ? '...' : ''));
      
      // Forward the transcript data to the client
      socket.emit('transcript', transcript);
    });

    // Handle Deepgram metadata events
    dgConnection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
      console.log('📋 Received metadata from Deepgram:', metadata);
    });

    // Handle Deepgram utterance end events
    dgConnection.on(LiveTranscriptionEvents.UtteranceEnd, (utterance) => {
      console.log('🔚 Utterance end event received:', utterance);
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
      
      // Try to extract close message if available
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

    // Handle audio data from client - special handling for binary data
    socket.on('audioData', (data) => {
      console.log(`📣 Received audio data from client: ${data.byteLength || data.length || 'unknown'} bytes`);
      
      if (dgConnection && dgConnection.getReadyState() === 1) { // 1 = OPEN
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

    // Add test transcript feature
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

    // Send connection status to client
    socket.emit('connectionStatus', { connected: true });

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
