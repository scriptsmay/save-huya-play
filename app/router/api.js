const express = require('express');
const axios = require('axios');
const router = express.Router();
// 导入配置文件
const config = require('../../config/config');

// // 定义路由
// router.get('/', (req, res) => {
//   res.send('通知中心');
// });

// router.get('/:id', (req, res) => {
//   res.send(`用户ID: ${req.params.id}`);
// });

// 新增: GET /api 路由，返回欢迎信息
router.get('/', (req, res) => {
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
router.get('/notify', async (req, res) => {
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
router.post('/notify', async (req, res) => {
  try {
    let { title = '', content = '', type = 'qq' } = req.query;
    // console.log('[DEBUG]request data:----->', req.body);
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

module.exports = router;
