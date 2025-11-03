const { Pool } = require('pg');
const config = require('../config/config');

const pool = new Pool({
  user: config.DB_USER,
  host: config.DB_HOST,
  database: config.DB_NAME,
  password: config.DB_PASSWORD,
  port: config.DB_PORT || 5432,
});

async function cleanOldVideos() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 查询数量
    const countResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM videos 
      WHERE substring(date from 1 for 10)::date < CURRENT_DATE - INTERVAL '3 months'
    `);

    const oldCount = parseInt(countResult.rows[0].count, 10);
    console.log(`过期视频数量: ${oldCount}`);

    if (oldCount > 0) {
      // 执行删除
      const deleteResult = await client.query(`
        DELETE FROM videos 
        WHERE substring(date from 1 for 10)::date < CURRENT_DATE - INTERVAL '3 months'
      `);

      await client.query('COMMIT');
      console.log(`成功删除 ${deleteResult.rowCount} 个过期视频`);
      return deleteResult.rowCount;
    } else {
      console.log('没有需要删除的过期视频');
      return 0;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// 执行清理
cleanOldVideos()
  .then((count) => {
    console.log(`清理完成，删除了 ${count} 条记录`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('清理失败:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
