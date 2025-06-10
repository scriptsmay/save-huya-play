require('dotenv').config();
// const fs = require('fs');
const path = require('path');
const axios = require('axios');

const { MESSAGE_PUSHER_SERVER, MESSAGE_PUSHER_USERNAME, MESSAGE_PUSHER_TOKEN } =
  process.env;

/**
 * 
 * 发送消息
 * ```
sendMessage('标题', '', '**内容**').then(
  (response) => {
    if (response.success) {
      console.log('推送成功:', response);
    } else {
      console.log('推送失败:', response);
    }
  },
  (error) => {
    console.log(error.message);
  }
);
```
 * @param {*} title 标题
 * @param {*} content 内容
 * @param {*} description 简要描述
 * @returns 
 */
async function sendMessage(title, content, description = '') {
  if (!MESSAGE_PUSHER_SERVER || !MESSAGE_PUSHER_USERNAME) {
    return Promise.resolve({
      success: false,
      message: '未配置消息推送服务',
    });
  }
  try {
    const postData = JSON.stringify({
      title: title,
      desp: description,
      content: content + '\n来自：http://192.168.31.10:3210/',
      token: MESSAGE_PUSHER_TOKEN,
      // 通道名称 ，不填默认是 飞书-webhook
      // channel: '飞书-测试应用',
    });

    const response = await axios.post(
      `${MESSAGE_PUSHER_SERVER}/push/${MESSAGE_PUSHER_USERNAME}`,
      postData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    if (response.data.success) {
      return response.data;
    }
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    } else {
      throw error;
    }
  }
}

function createFileUri(filePath) {
  // 转换路径为绝对路径并处理Windows的反斜杠
  const absolutePath = path.resolve(filePath).replace(/\\/g, '/');
  console.log(process.platform);

  // 构造file URI (Windows需要额外的斜杠)
  if (process.platform === 'win32') {
    return `file:///${absolutePath}`;
  }
  return `file://${absolutePath}`;
}

/**
 * 发送图片消息，目前好像只有QQ支持
 * @param {*} filepath
 * @returns
 */
async function sendPicture(filepath) {
  try {
    const API = 'http://192.168.31.10:3000/send_group_msg';
    const postData = {
      group_id: 1034923436,
      message: [
        {
          type: 'image',
          data: {
            file: createFileUri(filepath), // 图片文件本地路径
            // "url": "https://xxx",   // 图片URL
            // "md5": "3F7D797BE1AF0A" // 图片md5 (大写)
          },
        },
        {
          type: 'text',
          data: { text: '来自：http://192.168.31.10:3210/' },
        },
      ],
    };

    const response = await axios.post(API, postData);
    if (response.data.success) {
      return response.data;
    }
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    } else {
      throw error;
    }
  }
}

module.exports = { sendMessage, sendPicture };
