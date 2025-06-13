require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const morgan = require('morgan'); // 引入morgan日志中间件
const ejsLayouts = require('express-ejs-layouts');

const app = express();
const port = process.env.PORT || 3000;

// 日志目录
const logsDir = path.join(__dirname, '../logs');
const screenshotDir = path.join(__dirname, '../logs/screenshot');
const { LOG_ERR_HTML } = require('./template');

// 导入配置文件
const config = require('../config/config');

// PostgreSQL 连接配置
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// 设置模板引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(ejsLayouts);

// 静态文件
app.use(express.static('public'));

// 中间件：解析URL编码的查询参数
app.use(express.urlencoded({ extended: true }));

// 新增: 使用morgan记录访问日志
// 参数有 combined short dev
const morganFormat = 'dev';
app.use(morgan(morganFormat)); // 使用 combined 格式记录日志

// 中间件
app.use((req, res, next) => {
  res.locals.path = req.path;
  res.locals.title = 'Node.js + PostgreSQL';
  next();
});

// 路由：获取分页数据
app.get('/', async (req, res) => {
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
app.get('/logs', async (req, res) => {
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
app.get('/logs/delete', async (req, res) => {
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
app.get('/screenshot', (req, res) => {
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
app.get('/screenshot/:filename', (req, res) => {
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
app.get('/screenshot-delete', async (req, res) => {
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

// 新增: GET /api 路由，返回欢迎信息
app.get('/api', (req, res) => {
  const typeList = config.apiConfig.map((item) => item.type);
  res.status(200).json({
    message:
      '欢迎使用通知服务，目前支持的type类型为： ' +
      typeList.join(', ') +
      ' ，请在请求url中提供title（必填）和content参数。',
    status: 'ok',
    data: {
      api: '/api/notify',
      // typeList
    },
  });
});

// 处理/api/notify请求
app.get('/api/notify', async (req, res) => {
  try {
    const { title = '', content = '', type = 'qq' } = req.query;

    // 验证title参数
    // content 可以为空
    if (!title) {
      return res.status(403).json({
        error: 'title 参数不能为空',
      });
    }

    // 根据type查找对应的API地址
    const apiConfig = config.apiConfig.find((item) => item.type === type);
    if (!apiConfig) {
      return res.status(403).json({
        error: '不支持的type类型',
      });
    }

    if (!apiConfig.url) {
      return res.status(404).json({
        error: '未配置API地址',
      });
    }

    const data = apiConfig.dataTpl
      ? apiConfig.dataTpl
          .replace('{{title}}', title)
          .replace('{{content}}', content)
      : {};
    console.log('[DEBUG]formatted data:----->', data);
    // 转发请求
    const response = await axios({
      url: apiConfig.url,
      method: apiConfig.method || 'get',
      data,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 将目标服务的响应返回给客户端
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('转发请求时出错:', error);

    // 错误处理
    if (error.response) {
      // 目标服务器返回了错误响应
      res.status(error.response.status).json({
        error: '转发请求失败',
        details: error.response.data,
      });
    } else {
      // 其他类型的错误
      res.status(500).json({
        error: '内部服务器错误',
        details: error.message,
      });
    }
  }
});

/**
 * POST /api/notify
 * @param {*} req body { title: '标题', content: '内容', type: '', pic_url: '', jump_url: '' }
 * @param {*} res
 */
app.post('/api/notify', async (req, res) => {
  try {
    let { title = '', content = '', type = 'qq' } = req.query;
    console.log('[DEBUG]request data:----->', req.body);
    const { pic_url = '', jump_url = '' } = req.body;
    if (req.body.title) {
      title = req.body.title;
    }
    if (req.body.content) {
      content = req.body.content;
    }

    // 根据type查找对应的API地址
    const apiConfig = config.apiConfig.find((item) => item.type === type);
    if (!apiConfig) {
      return res.status(403).json({
        error: '不支持的type类型',
      });
    }

    let dataStr = apiConfig.dataTpl
      ? apiConfig.dataTpl
          .replace('{{title}}', title)
          .replace('{{content}}', content)
      : '{}';
    const msgData = JSON.parse(dataStr);
    // QQ允许转发图片和跳转链接
    if (type == 'qq') {
      if (pic_url) {
        msgData.message.push({
          type: 'image',
          data: {
            url: pic_url,
          },
        });
      }
      if (jump_url) {
        msgData.message.push({
          type: 'text',
          data: { text: `Go： ${jump_url}` },
        });
      }
    }
    // 转发请求
    const response = await axios({
      url: apiConfig.url,
      method: apiConfig.method || 'get',
      data: msgData,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 将目标服务的响应返回给客户端
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('转发请求时出错:', error);

    // 错误处理
    if (error.response) {
      // 目标服务器返回了错误响应
      res.status(error.response.status).json({
        error: '转发请求失败',
        details: error.response.data,
      });
    } else {
      // 其他类型的错误
      res.status(500).json({
        error: '内部服务器错误',
        details: error.message,
      });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
