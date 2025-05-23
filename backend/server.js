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

// Static files
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

// Initialize Deepgram with the new v4 method
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
      model: 'nova-2',
      language: 'nl',
      smart_format: true,
      interim_results: true
    });
    console.log('✅ Deepgram connection object created');
    
    // Try both uppercase and lowercase event names for compatibility
    // Using the LiveTranscriptionEvents enum for correct event names
    dgConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('🎙️ Deepgram connection SUCCESSFULLY opened');
      socket.emit('status', { status: 'connected', message: 'Deepgram verbinding actief' });
      
      // Set up KeepAlive to prevent timeouts
      keepAliveInterval = setInterval(() => {
        if (dgConnection) {
          console.log('📢 Sending KeepAlive to Deepgram');
          dgConnection.send({ type: 'KeepAlive' });
        }
      }, 5000);
    });

    // Also try lowercase event name as fallback
    dgConnection.on('open', () => {
      console.log('🎙️ Deepgram connection open (lowercase event)');
      socket.emit('status', { status: 'connected', message: 'Deepgram verbinding actief' });
      
      if (!keepAliveInterval) {
        keepAliveInterval = setInterval(() => {
          if (dgConnection) {
            console.log('📢 Sending KeepAlive to Deepgram (lowercase handler)');
            dgConnection.send({ type: 'KeepAlive' });
          }
        }, 5000);
      }
    });

    // Handle transcription results from Deepgram with v4 event syntax
    dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
      console.log('📝 Received transcript from Deepgram');
      socket.emit('transcript', data);
    });

    // Lowercase fallback
    dgConnection.on('transcript', (data) => {
      console.log('📝 Received transcript from Deepgram (lowercase event)');
      socket.emit('transcript', data);
    });

    // Handle Deepgram errors with v4 event syntax
    dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('❌ Deepgram error:', error);
      console.error('Error details:', JSON.stringify(error));
      socket.emit('error', { 
        message: 'Fout in Deepgram verbinding', 
        details: error.message || 'Onbekende fout' 
      });
    });

    // Lowercase fallback
    dgConnection.on('error', (error) => {
      console.error('❌ Deepgram error (lowercase event):', error);
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

    // Lowercase fallback
    dgConnection.on('close', () => {
      console.log('🔴 Deepgram verbinding gesloten (lowercase event)');
      socket.emit('status', { status: 'disconnected', message: 'Deepgram verbinding gesloten' });
      
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    });

    // Handle audio data from client
    socket.on('audioData', (data) => {
      if (dgConnection) {
        console.log('📣 Received audio data from client, length:', 
          typeof data === 'string' ? data.length : (data.byteLength || 'unknown'));
        
        try {
          dgConnection.send(data);
          console.log('✅ Audio data sent to Deepgram');
        } catch (err) {
          console.error('❌ Error sending audio to Deepgram:', err);
        }
      }
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
