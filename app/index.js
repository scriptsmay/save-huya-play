require('dotenv').config();
require('module-alias/register');
const express = require('express');
const path = require('path');

const morgan = require('morgan'); // 引入morgan日志中间件
const ejsLayouts = require('express-ejs-layouts');

const app = express();
const port = process.env.PORT || 3000;

const htmlRouter = require('./router/html');
const apiRouter = require('./router/api');

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

// 使用路由
app.use('/', htmlRouter);
app.use('/api', apiRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
