const { createClient } = require('redis');
require('dotenv').config();

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

async function publishNotification(data) {
  await redis.publish('notification', JSON.stringify(data));
}

module.exports = {
  publishNotification
};
