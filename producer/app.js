require('dotenv').config();
const express = require('express');
const client = require('prom-client');
const redis = require('redis');

const app = express();
app.use(express.json());

// =============== Prometheus Setup ===============
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// 1️⃣ HTTP Request Counter
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP Requests',
  labelNames: ['method', 'route', 'status']
});
register.registerMetric(httpRequestCounter);

// 2️⃣ HTTP Request Duration (Histogram)
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5] // detik
});
register.registerMetric(httpRequestDuration);

// 3️⃣ Redis Publish Counter (Success / Fail)
const publishCounter = new client.Counter({
  name: 'redis_publish_total',
  help: 'Total Redis Publish Events',
  labelNames: ['status']
});
register.registerMetric(publishCounter);

// 4️⃣ Redis Connection Status Gauge
const redisStatusGauge = new client.Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1=connected, 0=disconnected)'
});
register.registerMetric(redisStatusGauge);

// 5️⃣ Redis Retry Counter
const retryCounter = new client.Counter({
  name: 'redis_publish_retry_total',
  help: 'Total Redis publish retries'
});
register.registerMetric(retryCounter);

// =============== Redis Setup ===============
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected');
  redisStatusGauge.set(1);
});

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
  redisStatusGauge.set(0);
});

redisClient.connect();

// =============== Routes ===============
app.post('/create-order', async (req, res) => {
  const { user_id, order_id } = req.body;
  const message = {
    type: 'order_created',
    user_id: String(user_id),
    order_id,
    message: `Order #${order_id} has been created!`
  };

  const end = httpRequestDuration.startTimer(); // ⏱ Start timing

  try {
    let attempts = 0;
    let success = false;

    // Simulate retry mechanism
    while (attempts < 3 && !success) {
      try {
        await publishNotification(message);
        publishCounter.inc({ status: 'success' });
        success = true;
      } catch (err) {
        attempts++;
        retryCounter.inc(); // 🔁 Retry metric
        if (attempts >= 3) throw err;
      }
    }

    httpRequestCounter.inc({ method: 'POST', route: '/create-order', status: 200 });
    end({ method: 'POST', route: '/create-order', status: 200 });
    res.status(200).json({ success: true, sent: message });

  } catch (err) {
    publishCounter.inc({ status: 'fail' });
    httpRequestCounter.inc({ method: 'POST', route: '/create-order', status: 500 });
    end({ method: 'POST', route: '/create-order', status: 500 });
    res.status(500).json({ error: 'Failed to publish message' });
  }
});

// =============== Metrics Endpoint ===============
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// =============== Start Server ===============
app.listen(3000, () => {
  console.log('🚀 Producer running at http://localhost:3000');
  console.log('📈 Metrics available at http://localhost:3000/metrics');
});
