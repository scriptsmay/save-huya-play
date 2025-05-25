require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

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

// 路由：获取分页数据
app.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const searchTerm = req.query.search || '';

    // 构建基础查询
    let countQuery = 'SELECT COUNT(*) FROM videos';
    let dataQuery = 'SELECT * FROM videos';
    const queryParams = [];
    
    // 添加搜索条件
    if (searchTerm) {
      countQuery += ' WHERE title ILIKE $1 OR username ILIKE $1';
      dataQuery += ' WHERE title ILIKE $1 OR username ILIKE $1';
      queryParams.push(`%${searchTerm}%`);
    }

    // 添加排序和分页
    dataQuery += ' ORDER BY id LIMIT $' + (queryParams.length + 1) + 
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});