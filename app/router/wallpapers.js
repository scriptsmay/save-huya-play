const express = require('express');
const router = express.Router();
const wallpaperPool = require('../../config/wallpaperPg');
const redisClient = require('../remoteRedis');

// format: "https://{domain}{data.urlbase}_{hd}.{ext}&{query}",
// example: "https://cn.bing.com/th?id=OHR.CostadaMorte_EN-US3132736041_1920x1080.jpg&w=384&h=216",
/**
 * 壁纸分辨率列表
 */
const hdList = [
  'UHD',
  '1920x1200',
  '1920x1080',
  '1366x768',
  '1280x768',
  '1024x768',
  '800x600',
  '800x480',
  '768x1280',
  '720x1280',
  '640x480',
  '480x800',
  '400x240',
  '320x240',
  '240x320',
];
// 获取壁纸列表页面
router.get('/', async (req, res) => {
  try {
    const result = await wallpaperPool.query(
      'SELECT id, url, title, created_at FROM wallpapers ORDER BY created_at DESC'
    );
    // 处理数据，为每个分辨率生成字段
    // 如 url_UHD, url_1280_768, url_800_480
    const wallpapers = result.rows.map((wallpaper) => {
      if (!wallpaper.url || typeof wallpaper.url !== 'string') {
        return wallpaper;
      }

      // 复制原始对象
      const processed = { ...wallpaper };

      // 为每个分辨率生成字段
      hdList.forEach((resolution) => {
        const fieldName = `url_${resolution.toLowerCase().replace('x', '_')}`;
        processed[fieldName] = wallpaper.url.replace(/_UHD/g, `_${resolution}`);
      });

      return processed;
    });

    res.render('wallpapers/index', {
      wallpapers,
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
