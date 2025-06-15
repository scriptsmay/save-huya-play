// utils/redisClient.js
const { createClient } = require('redis');
require('dotenv').config();

class RedisClient {
  constructor() {
    this.client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
      username: process.env.REDIS_USER || 'default',
      password: process.env.REDIS_PASSWORD,
    });

    this.client.on('error', (err) => console.error('Redis Client Error:', err));
    this.client.on('connect', () => console.log('Redis connected'));
    this.client.on('ready', () => console.log('Redis ready to use'));
    this.client.on('end', () => console.log('Redis disconnected'));

    // 连接 Redis
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
    } catch (err) {
      console.error('Redis connection failed:', err);
    }
  }

  async disconnect() {
    try {
      await this.client.destroy();
    } catch (err) {
      console.error('Redis destroy failed:', err);
    }
  }

  // 封装常用方法
  async set(key, value, options = {}) {
    try {
      return await this.client.set(key, value, options);
    } catch (err) {
      console.error('Redis set error:', err);
      throw err;
    }
  }

  async get(key) {
    try {
      return await this.client.get(key);
    } catch (err) {
      console.error('Redis get error:', err);
      throw err;
    }
  }

  async del(key) {
    try {
      return await this.client.del(key);
    } catch (err) {
      console.error('Redis del error:', err);
      throw err;
    }
  }

  async expire(key, seconds) {
    try {
      return await this.client.expire(key, seconds);
    } catch (err) {
      console.error('Redis expire error:', err);
      throw err;
    }
  }

  // 其他需要的方法可以继续添加...
}

// 创建单例实例
const redisClient = new RedisClient();

// 程序退出时关闭连接
process.on('SIGINT', async () => {
  await redisClient.disconnect();
  process.exit();
});

module.exports = redisClient;
