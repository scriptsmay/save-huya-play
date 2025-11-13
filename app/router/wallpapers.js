const express = require('express');
const router = express.Router();
const wallpaperPool = require('../../config/wallpaperPg');
const redisClient = require('../remoteRedis');

// 获取壁纸列表页面
router.get('/', async (req, res) => {
  try {
    const result = await wallpaperPool.query(
      'SELECT id, url, title, created_at FROM wallpapers ORDER BY created_at DESC'
    );
    res.render('wallpapers/index', {
      wallpapers: result.rows,
      title: '壁纸管理',
      styles: `<link href="/css/wallpapers.css" rel="stylesheet" />`,
    });
  } catch (err) {
    console.error('获取壁纸列表失败:', err);
    res.status(500).send('服务器错误');
  }
});

// 添加壁纸
router.post('/add', async (req, res) => {
  const { url, title } = req.body;

  if (!url) {
    return res.status(400).send('URL 不能为空');
  }

  try {
    // 先检查 Redis 连接
    if (!redisClient.isConnected) {
      console.log('Redis not connected, attempting to reconnect...');
      await redisClient.connect();
    }

    // 使用事务确保数据一致性（如果支持）
    // 或者按顺序执行：Redis 先，PostgreSQL 后
    await redisClient.sAdd('wallpapers', url);

    // 如果 Redis 成功，再插入 PostgreSQL
    await wallpaperPool.query(
      'INSERT INTO wallpapers(url, title) VALUES($1, $2)',
      [url, title || '']
    );

    console.log(`壁纸添加成功: ${url}`);
    res.redirect('/wallpapers');
  } catch (err) {
    console.error('添加壁纸失败:', err);

    // 根据错误类型返回不同的错误信息
    if (
      err.message.includes('ECONNREFUSED') ||
      err.message.includes('WRONGPASS')
    ) {
      res.status(503).send('系统暂时不可用，请稍后重试');
    } else if (err.message.includes('duplicate key')) {
      res.status(400).send('该壁纸已存在');
    } else {
      res.status(500).send('添加壁纸失败');
    }
  }
});

// 删除壁纸
router.post('/delete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await wallpaperPool.query('DELETE FROM wallpapers WHERE id = $1', [id]);
    res.redirect('/wallpapers');
  } catch (err) {
    console.error('删除壁纸失败:', err);
    res.status(500).send('删除壁纸失败');
  }
});

// 直接返回图片接口
router.get('/image', async (req, res) => {
  try {
    const { id } = req.query;

    let result;
    if (id) {
      // 通过ID查询指定壁纸
      result = await wallpaperPool.query(
        'SELECT id, url, title, created_at FROM wallpapers WHERE id = $1',
        [id]
      );
    } else {
      // 随机查询一个壁纸
      result = await wallpaperPool.query(
        'SELECT id, url, title, created_at FROM wallpapers ORDER BY RANDOM() LIMIT 1'
      );
    }

    if (result.rows.length > 0) {
      const wallpaperUrl = result.rows[0].url;

      // 重定向到实际的图片URL
      res.redirect(wallpaperUrl);
    } else {
      res.status(404).send('壁纸不存在');
    }
  } catch (err) {
    console.error('获取壁纸图片失败:', err);
    if (!res.headersSent) {
      res.status(500).send('获取壁纸图片失败');
    }
  }
});

router.get('/get', async (req, res) => {
  try {
    const { id } = req.query;

    if (id) {
      // 通过ID查询指定壁纸
      const result = await wallpaperPool.query(
        'SELECT id, url, title, created_at FROM wallpapers WHERE id = $1',
        [id]
      );

      if (result.rows.length > 0) {
        res.json({
          success: true,
          data: result.rows[0],
        });
      } else {
        res.status(404).json({
          success: false,
          message: '壁纸不存在',
        });
      }
    } else {
      // 随机查询一个壁纸
      const result = await wallpaperPool.query(
        'SELECT id, url, title, created_at FROM wallpapers ORDER BY RANDOM() LIMIT 1'
      );

      if (result.rows.length > 0) {
        res.json({
          success: true,
          data: result.rows[0],
        });
      } else {
        res.json({
          success: false,
          message: '暂无壁纸数据',
        });
      }
    }
  } catch (err) {
    console.error('查询壁纸失败:', err);
    res.status(500).json({
      success: false,
      message: '查询壁纸失败',
    });
  }
});

module.exports = router;
