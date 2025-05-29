require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

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

// 静态文件
app.use(express.static('public'));

// 中间件
app.use((req, res, next) => {
  res.locals.path = req.path;
  // res.locals.searchTerm = req.query.search || '';
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
      const searchQuery = ' WHERE title ILIKE $1 OR username ILIKE $1 OR date ILIKE $1'
      countQuery += searchQuery;
      dataQuery += searchQuery;
      queryParams.push(`%${searchTerm}%`);
    }

    // 默认排序
    dataQuery += ' ORDER BY created_at DESC';
    // 添加分页
    dataQuery += ' LIMIT $' + (queryParams.length + 1) + 
                 ' OFFSET $' + (queryParams.length + 2);
    queryParams.push(limit, offset);

    // 获取数据总数
    const countResult = await pool.query(countQuery, queryParams.slice(0, searchTerm ? 1 : 0));
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // 获取当前页数据
    const dataResult = await pool.query(dataQuery, queryParams);

    res.render('index', {
      videos: dataResult.rows,
      currentPage: page,
      totalPages,
      limit,
      searchTerm  // 传递搜索词到前端
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 路由：查看 logs 目录下的 .log 文件
app.get('/logs', async (req, res) => {
  const logsDir = path.join(__dirname, '../logs'); // 日志目录

  try {
    // 获取目录中的文件列表
    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter(file => file.endsWith('.log'));

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
    res.status(500).send('无法读取日志文件');
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});