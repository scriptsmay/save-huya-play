// @config/redis.js
require('dotenv').config();
const { createClient } = require('redis');

class RedisClient {
  constructor(options = {}) {
    this._isConnected = false;
    this._isConnecting = false;
    this._pendingOperations = [];

    this._config = this._mergeConfig(options);
    this._initClient();
  }

  _mergeConfig(customOptions = {}) {
    // 判断是否使用连接字符串
    const useConnectionString =
      process.env.REDIS_CONNECTION_STRING ||
      (process.env.REMOTE_REDIS_HOST && process.env.REMOTE_REDIS_PASSWORD);

    if (useConnectionString) {
      // 使用连接字符串方式
      let connectionString;

      if (process.env.REDIS_CONNECTION_STRING) {
        connectionString = process.env.REDIS_CONNECTION_STRING;
      } else {
        // 构建连接字符串
        const protocol =
          process.env.REDIS_SSL === 'true' ? 'rediss://' : 'redis://';
        const username = process.env.REDIS_USER || 'default';
        const password =
          process.env.REMOTE_REDIS_PASSWORD || process.env.REDIS_PASSWORD;
        const host = process.env.REMOTE_REDIS_HOST || process.env.REDIS_HOST;
        const port = process.env.REMOTE_REDIS_PORT || process.env.REDIS_PORT;

        connectionString = `${protocol}${username}:${password}@${host}:${port}`;
      }

      return {
        url: connectionString,
        ...customOptions,
      };
    } else {
      // 使用传统配置对象方式
      const defaultConfig = {
        socket: {
          host: 'localhost',
          port: 6379,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Max retry attempts (10) reached');
              return new Error('Max retries reached');
            }
            const delay = Math.min(100 * Math.pow(2, retries), 5000);
            return delay;
          },
          tls: process.env.REDIS_SSL === 'true' ? {} : undefined,
        },
        username: 'default',
        password: undefined,
        database: 0,
      };

      const envConfig = {
        socket: {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT
            ? parseInt(process.env.REDIS_PORT)
            : undefined,
          tls: process.env.REDIS_SSL === 'true' ? {} : undefined,
        },
        username: process.env.REDIS_USER || 'default',
        password: process.env.REDIS_PASSWORD,
        database: process.env.REDIS_DB
          ? parseInt(process.env.REDIS_DB)
          : undefined,
      };

      // 深度合并配置
      const mergeDeep = (target, source) => {
        const result = { ...target };
        for (const key of Object.keys(source)) {
          if (source[key] instanceof Object && key in result) {
            result[key] = mergeDeep(result[key], source[key]);
          } else {
            result[key] = source[key];
          }
        }
        return result;
      };

      let merged = mergeDeep(defaultConfig, envConfig);
      merged = mergeDeep(merged, customOptions);

      // 清理 undefined 值
      const cleanConfig = (obj) => {
        Object.keys(obj).forEach((key) => {
          if (obj[key] === undefined || obj[key] === '') {
            delete obj[key];
          } else if (obj[key] instanceof Object) {
            cleanConfig(obj[key]);
          }
        });
        return obj;
      };

      return cleanConfig(merged);
    }
  }

  _initClient() {
    if (this._config.url) {
      console.log('Initializing Redis client with connection string:', {
        // 安全地显示连接信息（隐藏密码）
        url: this._config.url.replace(/:[^:@]+@/, ':***@'),
      });
    } else {
      console.log('Initializing Redis client with config:', {
        host: this._config.socket?.host,
        port: this._config.socket?.port,
        database: this._config.database,
        hasUsername: !!this._config.username,
        hasPassword: !!this._config.password,
        useSSL: !!this._config.socket?.tls,
      });
    }

    this.client = createClient(this._config);
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
      console.log(
        'Redis connected to',
        this._config.socket?.host + ':' + this._config.socket?.port
      );
      this._isConnected = true;
      this._processPendingOperations();
    });

    this.client.on('ready', () => {
      console.log('Redis ready to use (DB:', this._config.database + ')');
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
    if (!this.client || !this._isConnected) {
      return;
    }
    this._isConnected = false;
    try {
      await this.client.quit();
    } catch (err) {
      console.error('Redis disconnect failed:', err);
      try {
        await this.client.destroy();
        console.log('Redis 已强制断开');
      } catch (destroyErr) {
        console.error('Redis force disconnect also failed:', destroyErr);
      }
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

  // Redis 集合操作
  async sAdd(key, members) {
    return this._executeWithRetry('sAdd', this.client.sAdd, [key, members]);
  }

  async sRem(key, members) {
    return this._executeWithRetry('sRem', this.client.sRem, [key, members]);
  }

  async sMembers(key) {
    return this._executeWithRetry('sMembers', this.client.sMembers, [key]);
  }

  async sIsMember(key, member) {
    return this._executeWithRetry('sIsMember', this.client.sIsMember, [
      key,
      member,
    ]);
  }

  // 其他常用方法...
  async keys(pattern) {
    return this._executeWithRetry('keys', this.client.keys, [pattern]);
  }

  async exists(key) {
    return this._executeWithRetry('exists', this.client.exists, [key]);
  }

  async ttl(key) {
    return this._executeWithRetry('ttl', this.client.ttl, [key]);
  }

  get isConnected() {
    return this._isConnected;
  }

  get config() {
    return { ...this._config };
  }
}

// 创建默认单例实例（使用环境变量或默认配置）
const redisClient = new RedisClient();

// 创建自定义实例的工厂函数
RedisClient.createClient = (options = {}) => {
  return new RedisClient(options);
};

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
module.exports.RedisClient = RedisClient;
