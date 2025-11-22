require('dotenv').config();
const { RedisClient } = require('../config/redis');

const redisClient = RedisClient.createClient({
  url: process.env.REDIS_CONNECTION_STRING,
});

module.exports = redisClient;
