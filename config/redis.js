// @config/redis.js
require('dotenv').config();
const { createClient } = require('redis');

class RedisClient {
  constructor() {
    this._isConnected = false;
    this._isConnecting = false;
    this._pendingOperations = [];
    this._initClient();
  }

  _initClient() {
    this.client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Max retry attempts (10) reached');
            return new Error('Max retries reached');
          }
          // 指数退避: 100ms, 200ms, 400ms, ..., max 5s
          const delay = Math.min(100 * Math.pow(2, retries), 5000);
          return delay;
        },
      },
      username: process.env.REDIS_USER || 'default',
      password: process.env.REDIS_PASSWORD,
    });

    this._setupEventListeners();
    this.connect().catch((err) => {
      console.error('Initial connection attempt failed:', err);
    });
  }

  _setupEventListeners() {
    this.client.on('error', (err) => {
      if (err.code === 'ECONNRESET') {
        console.warn('Redis connection reset');
      } else {
        console.error('Redis error:', err);
      }
      this._isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis connected');
      this._isConnected = true;
      this._processPendingOperations();
    });

    this.client.on('ready', () => {
      console.log('Redis ready to use');
      this._isConnected = true;
    });

    this.client.on('end', () => {
      console.log('Redis disconnected');
      this._isConnected = false;
    });
  }

  async _processPendingOperations() {
    while (this._pendingOperations.length > 0) {
      const operation = this._pendingOperations.shift();
      try {
        const result = await operation.fn();
        operation.resolve(result);
      } catch (err) {
        operation.reject(err);
      }
    }
  }

  async connect() {
    if (this._isConnected || this._isConnecting) return;

    this._isConnecting = true;
    try {
      await this.client.connect();
      this._isConnected = true;
    } catch (err) {
      console.error('Redis connection failed:', err);
      throw err;
    } finally {
      this._isConnecting = false;
    }
  }

  async disconnect() {
    try {
      this._isConnected = false;
      await this.client.quit();
    } catch (err) {
      console.error('Redis disconnect failed:', err);
      // 强制断开连接
      await this.client.destroy();
    }
  }

  async _executeWithRetry(operationName, fn, args) {
    if (!this._isConnected) {
      return new Promise((resolve, reject) => {
        this._pendingOperations.push({
          fn: () => this._executeWithRetry(operationName, fn, args),
          resolve,
          reject,
        });

        // 尝试重新连接
        if (!this._isConnecting) {
          this.connect().catch((err) => {
            console.error('Auto-reconnect failed:', err);
          });
        }
      });
    }

    try {
      return await fn.apply(this.client, args);
    } catch (err) {
      if (err.code === 'ECONNRESET' || err.code === 'NR_CLOSED') {
        console.warn(
          `Redis ${operationName} operation failed due to connection issue, retrying...`
        );
        this._isConnected = false;
        return this._executeWithRetry(operationName, fn, args);
      }
      console.error(`Redis ${operationName} error:`, err);
      throw err;
    }
  }

  // 封装常用方法
  async set(key, value, options = {}) {
    return this._executeWithRetry('set', this.client.set, [
      key,
      value,
      options,
    ]);
  }

  async get(key) {
    return this._executeWithRetry('get', this.client.get, [key]);
  }

  async del(key) {
    return this._executeWithRetry('del', this.client.del, [key]);
  }

  async expire(key, seconds) {
    return this._executeWithRetry('expire', this.client.expire, [key, seconds]);
  }

  async hSet(key, field, value) {
    return this._executeWithRetry('hSet', this.client.hSet, [
      key,
      field,
      value,
    ]);
  }

  async hGetAll(key) {
    return this._executeWithRetry('hGetAll', this.client.hGetAll, [key]);
  }

  // 其他需要的方法可以继续添加...

  get isConnected() {
    return this._isConnected;
  }
}

// 创建单例实例
const redisClient = new RedisClient();

// 程序退出时优雅关闭连接
const cleanup = async () => {
  try {
    await redisClient.disconnect();
    console.log('Redis connection closed gracefully');
  } catch (err) {
    console.error('Error during Redis cleanup:', err);
  } finally {
    process.exit();
  }
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', async (err) => {
  console.error('Uncaught exception:', err);
  await cleanup();
});

module.exports = redisClient;
