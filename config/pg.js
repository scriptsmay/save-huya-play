require('dotenv').config();
const { Pool } = require('pg');

// 1. 配置数据库连接
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// 测试数据库连接
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('连接失败:', err);
  else {
    const dbTime = new Date(res.rows[0].now);
    console.log('数据库当前时间:', dbTime.toLocaleString());
  }
});

// 导出 pool 供其他模块使用
module.exports = pool;
