const { createClient } = require('redis');
require('dotenv').config();

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

async function subscribe(callback) {
  const subscriber = redis.duplicate();
  await subscriber.connect();

  await subscriber.subscribe('notification', (message) => {
    const data = JSON.parse(message);
    callback(data);
  });

  console.log('✅ Subscribed to Redis channel: notification');
}

module.exports = { subscribe };
