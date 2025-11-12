require('dotenv').config();
const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_CONNECTION_STRING,
});

module.exports = redisClient;
