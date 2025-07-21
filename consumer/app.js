require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { subscribe } = require('./queue/subscriber');
const client = require('prom-client');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

// === Prometheus Metrics ===
const connectedUsers = new client.Gauge({
  name: 'connected_users',
  help: 'Number of connected WebSocket users'
});

const notificationsSent = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications successfully sent'
});

const notificationsFailed = new client.Counter({
  name: 'notifications_failed_total',
  help: 'Total number of notifications that failed due to user not connected'
});

const incomingNotifications = new client.Counter({
  name: 'incoming_notifications_total',
  help: 'Total number of notifications received from Redis'
});

const redisConnectionStatus = new client.Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1 = connected, 0 = disconnected)'
});

// === Metrics Endpoint ===
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// === WebSocket Connection Tracking ===
const userSockets = new Map();

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  console.log(`🔌 User connected: ${userId}`);

  if (userId) {
    userSockets.set(userId, socket);
    connectedUsers.set(userSockets.size);
  }

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${userId}`);
    userSockets.delete(userId);
    connectedUsers.set(userSockets.size);
  });
});

// === Redis Subscribe ===
subscribe((data) => {
  incomingNotifications.inc();

  const { user_id, message } = data;

  const socket = userSockets.get(user_id);
  if (socket) {
    socket.emit('notification', message);
    notificationsSent.inc();
    console.log(`📨 Sent to ${user_id}: ${message}`);
  } else {
    notificationsFailed.inc();
    console.log(`⚠️ User ${user_id} not connected`);
  }
});

// === Redis Health Check ===
const redis = require('redis');
const redisClient = redis.createClient({ url: process.env.REDIS_URL });

redisClient.on('ready', () => {
  redisConnectionStatus.set(1);
});
redisClient.on('end', () => {
  redisConnectionStatus.set(0);
});
redisClient.connect();

server.listen(4000, () => {
  console.log('🔊 WebSocket server running on http://localhost:4000');
});
