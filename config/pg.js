const { Pool } = require('pg');

// 1. 配置数据库连接
const pool = new Pool({
  user: 'user_2hPFjc',
  host: '192.168.31.18',
  database: 'huya_playback',
  password: 'password_QWr6wQ',
  port: 15432,
});

// 测试数据库连接
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('连接失败:', err);
  else {
    const dbTime = new Date(res.rows[0].now);
    console.log('数据库当前时间:', dbTime.toLocaleString());
  }
});

// // 2. 检查表是否存在，不存在则创建
// async function initializeDatabase() {
//   const client = await pool.connect();
//   try {
//     // 检查表是否存在
//     const checkTableQuery = `
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables 
//         WHERE table_name = 'videos'
//       );
//     `;
//     const { rows } = await client.query(checkTableQuery);
//     const tableExists = rows[0].exists;

//     // 如果表不存在，则创建
//     if (!tableExists) {
//       const createTableQuery = `
//         CREATE TABLE videos (
//           id SERIAL PRIMARY KEY,
//           url VARCHAR(255) NOT NULL,
//           title VARCHAR(255),
//           duration VARCHAR(255),       -- 存储为字符串
//           cover VARCHAR(255),          -- 封面图 URL
//           date VARCHAR(255),           -- 日期字符串（如 "2023-10-01"）
//           created_at TIMESTAMP DEFAULT NOW()  -- 自动记录插入时间
//         );
//       `;
//       await client.query(createTableQuery);
//       console.log('表 videos 创建成功');
//     } else {
//       console.log('表 videos 已存在');
//     }
//   } catch (error) {
//     console.error('初始化数据库时出错:', error);
//   } finally {
//     client.release(); // 释放连接回连接池
//   }
// }

// // 3. 执行初始化
// initializeDatabase()
//   .then(() => console.log('数据库初始化完成'))
//   .catch(err => console.error('初始化失败:', err));

// 导出 pool 供其他模块使用
module.exports = pool;
