require('dotenv').config();
const { Pool } = require('pg');

// 配置壁纸数据库连接
const wallpaperPool = new Pool({
  user: process.env.WALLPAPER_DB_USER || process.env.DB_USER,
  host: process.env.WALLPAPER_DB_HOST || process.env.DB_HOST,
  database: process.env.WALLPAPER_DB_NAME || 'wallpaper', // 专门的壁纸数据库
  password: process.env.WALLPAPER_DB_PASSWORD || process.env.DB_PASSWORD,
  port: process.env.WALLPAPER_DB_PORT || process.env.DB_PORT || 5432,
});

// 测试数据库连接
wallpaperPool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('壁纸数据库连接失败:', err);
  else {
    const dbTime = new Date(res.rows[0].now);
    console.log('壁纸数据库当前时间:', dbTime.toLocaleString());
  }
});

// 导出 pool 供其他模块使用
module.exports = wallpaperPool;