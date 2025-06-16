const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const router = express.Router();

// 日志目录
const logsDir = path.join(__dirname, '../../logs');
const screenshotDir = path.join(__dirname, '../../logs/screenshot');
const { LOG_ERR_HTML } = require('../template');

// PostgreSQL 连接配置
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// 路由：获取分页数据
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const searchTerm = req.query.search || '';

    // 构建基础查询
    let countQuery = 'SELECT COUNT(*) FROM videos';
    let dataQuery = 'SELECT * FROM videos';
    const queryParams = [];

    // 添加搜索条件
    if (searchTerm) {
      const searchQuery =
        ' WHERE title ILIKE $1 OR username ILIKE $1 OR date ILIKE $1';
      countQuery += searchQuery;
      dataQuery += searchQuery;
      queryParams.push(`%${searchTerm}%`);
    }

    // 默认排序
    dataQuery += ' ORDER BY created_at DESC';
    // 添加分页
    dataQuery +=
      ' LIMIT $' +
      (queryParams.length + 1) +
      ' OFFSET $' +
      (queryParams.length + 2);
    queryParams.push(limit, offset);

    // 获取数据总数
    const countResult = await pool.query(
      countQuery,
      queryParams.slice(0, searchTerm ? 1 : 0)
    );
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // 获取当前页数据
    const dataResult = await pool.query(dataQuery, queryParams);

    res.render('index', {
      videos: dataResult.rows,
      currentPage: page,
      totalPages,
      limit,
      searchTerm, // 传递搜索词到前端
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 路由：查看 logs 目录下的 .log 文件
router.get('/logs', async (req, res) => {
  try {
    // 如果没有 logsDir 这个目录，则创建它
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }
    // 获取目录中的文件列表
    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter((file) => file.endsWith('.log'));

    // 获取查询参数 ?file=xxx.log
    const requestedFile = req.query.file;
    let selectedFileContent = '';
    let selectedFileName = '';

    if (requestedFile && logFiles.includes(requestedFile)) {
      const filePath = path.join(logsDir, requestedFile);
      selectedFileContent = fs.readFileSync(filePath, 'utf-8');
      selectedFileName = requestedFile;
    }

    // 返回 HTML 页面展示日志文件列表和内容
    res.render('logs', {
      logFiles,
      selectedFileName,
      selectedFileContent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(LOG_ERR_HTML);
  }
});

// 路由：删除指定名称的日志文件
router.get('/logs/delete', async (req, res) => {
  try {
    // 获取目录中的文件列表
    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter((file) => file.endsWith('.log'));

    // 获取查询参数 ?file=xxx.log
    const requestedFile = req.query.file;

    if (!requestedFile || !logFiles.includes(requestedFile)) {
      return res.status(400).send(LOG_ERR_HTML);
    }

    const filePath = path.join(logsDir, requestedFile);

    // 删除日志文件
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`无法删除文件: ${err.message}`);
        return res.status(500).send(LOG_ERR_HTML);
      }
      console.log(`文件 ${requestedFile} 已成功删除`);
      res.redirect('/logs'); // 删除完成后重定向回日志页面
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(LOG_ERR_HTML);
  }
});

// 路由：查看 logsDir 目录下的图片文件
router.get('/screenshot', (req, res) => {
  try {
    // 如果没有 screenshotDir 这个目录，则创建它
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }
    // 获取目录中的文件列表
    const files = fs.readdirSync(screenshotDir);
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );

    // 获取查询参数 ?file=image.jpg
    const requestedFile = req.query.file;
    let selectedFilePath = '';
    let selectedFileName = '';

    if (requestedFile && imageFiles.includes(requestedFile)) {
      selectedFileName = requestedFile;
      selectedFilePath = path.join(screenshotDir, requestedFile);
    }

    // 返回 HTML 页面展示图片列表和选中的图片
    res.render('screenshot', {
      imageFiles,
      selectedFileName,
      selectedFilePath,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('无法读取图片目录');
  }
});

// 允许通过 /screenshot/xxx.jpg 访问实际图片文件
router.get('/screenshot/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(screenshotDir, filename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('图片不存在');
    }
    res.sendFile(filePath);
  });
});

// 路由：删除指定名称的日志文件
router.get('/screenshot-delete', async (req, res) => {
  try {
    // 获取目录中的文件列表
    const files = fs.readdirSync(screenshotDir);
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );

    // 获取查询参数 ?file=xxx.log
    const requestedFile = req.query.file;

    if (!requestedFile || !imageFiles.includes(requestedFile)) {
      return res.status(400).send(LOG_ERR_HTML);
    }

    const filePath = path.join(screenshotDir, requestedFile);

    // 删除日志文件
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`无法删除文件: ${err.message}`);
        return res.status(500).send(LOG_ERR_HTML);
      }
      console.log(`文件 ${requestedFile} 已成功删除`);
      res.redirect('/screenshot'); // 删除完成后重定向回日志页面
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(LOG_ERR_HTML);
  }
});

module.exports = router;
