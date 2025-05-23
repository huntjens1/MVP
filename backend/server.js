import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
// Change this import to use createClient
import { createClient } from '@deepgram/sdk';
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

// Initialize Deepgram with the new v4 method
const deepgram = createClient(DEEPGRAM_API_KEY);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('🟢 Nieuwe Socket.io client verbonden');
  let dgConnection = null;
  let keepAliveInterval = null;

  try {
    // Create a live transcription connection with v4 syntax
    dgConnection = deepgram.listen.live({
      model: 'nova-2',
      language: 'nl', // Assuming Dutch based on your file comments
      smart_format: true,
      interim_results: true
    });

    // Handle Deepgram connection open with v4 event syntax
    dgConnection.on('Open', () => {
      console.log('🎙️ Deepgram verbinding geopend');
      socket.emit('status', { status: 'connected', message: 'Deepgram verbinding actief' });
      
      // Set up KeepAlive to prevent timeouts (critical for Railway)
      keepAliveInterval = setInterval(() => {
        if (dgConnection) {
          dgConnection.send({ type: 'KeepAlive' });
        }
      }, 5000);
    });

    // Handle transcription results from Deepgram with v4 event syntax
    dgConnection.on('Transcript', (data) => {
      socket.emit('transcript', data);
    });

    // Handle Deepgram errors with v4 event syntax
    dgConnection.on('Error', (error) => {
      console.error('❌ Deepgram fout:', error);
      socket.emit('error', { 
        message: 'Fout in Deepgram verbinding', 
        details: error.message || 'Onbekende fout' 
      });
    });

    // Handle Deepgram connection close with v4 event syntax
    dgConnection.on('Close', () => {
      console.log('🔴 Deepgram verbinding gesloten');
      socket.emit('status', { status: 'disconnected', message: 'Deepgram verbinding gesloten' });
      
      // Clear KeepAlive interval
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    });

    // Handle audio data from client
    socket.on('audioData', (data) => {
      if (dgConnection) {
        dgConnection.send(data);
      }
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log('🔴 Socket.io client ontkoppeld');
      
      // Clear KeepAlive interval
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      
      // Close Deepgram connection properly
      if (dgConnection) {
        dgConnection.send({ type: 'CloseStream' });
      }
    });

    // Handle client requesting to stop transcription
    socket.on('stopTranscription', () => {
      if (dgConnection) {
        dgConnection.send({ type: 'CloseStream' });
        
        // Clear KeepAlive interval
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
