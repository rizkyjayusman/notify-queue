const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { subscribe } = require('./queue/subscriber');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Ganti ini di production
  }
});

// Store connected users
const userSockets = new Map();

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  console.log(`🔌 User connected: ${userId}`);

  if (userId) {
    userSockets.set(userId, socket);
  }

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${userId}`);
    userSockets.delete(userId);
  });
});

// Subscribe to Redis and forward to connected users
subscribe((data) => {
  const { user_id, message } = data;

  const socket = userSockets.get(user_id);
  if (socket) {
    socket.emit('notification', message);
    console.log(`📨 Sent to ${user_id}: ${message}`);
  } else {
    console.log(`⚠️ User ${user_id} not connected`);
  }
});

app.use(express.static('public'));

server.listen(4000, () => {
  console.log('🔊 WebSocket server running on http://localhost:4000');
});
