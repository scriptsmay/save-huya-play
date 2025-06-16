const axios = require('axios');
const {
  siteUrl,
  MESSAGE_PUSHER_SERVER,
  MESSAGE_PUSHER_USERNAME,
  MESSAGE_PUSHER_TOKEN,
  MESSAGE_PUSHER_QQ_GROUP_ID = 1034923436,
} = require('../../config/config');

// 一个小群 881976357
// 消息发布 1034923436

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
      content: content + `\n来自：${siteUrl}`,
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

/**
 * 发送图片消息，目前好像只有QQ支持
 * @param {*} url
 * @returns
 */
async function sendPicture(url) {
  try {
    console.log('发送图片', url);
    const API = 'http://192.168.31.10:3000/send_group_msg';
    const postData = {
      group_id: parseInt(MESSAGE_PUSHER_QQ_GROUP_ID),
      message: [
        {
          type: 'image',
          data: {
            url,
            // file: imgBase64.dataURI, // 图片文件本地路径
            // "url": "https://xxx",   // 图片URL
            // "md5": "3F7D797BE1AF0A" // 图片md5 (大写)
          },
        },
        {
          type: 'text',
          data: { text: `来自：${siteUrl}` },
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
