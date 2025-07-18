require('module-alias/register');

const axios = require('axios');
const {
  siteUrl,
  MESSAGE_PUSHER_SERVER,
  MESSAGE_PUSHER_USERNAME,
  MESSAGE_PUSHER_TOKEN,
  MESSAGE_PUSHER_QQ_GROUP_ID = 1034923436,
} = require('@config');

const { isInAllowedTime } = require('./index');

// const fs = require('fs');
const larkClient = require('@/config/lark');

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
    const channelName = '飞书-webhook';
    const postData = JSON.stringify({
      title: title,
      desp: description,
      content: `${title}\n\n${content}\nfrom：${siteUrl}`,
      token: MESSAGE_PUSHER_TOKEN,
      // 通道名称 ，不填默认是 飞书-webhook
      channel: channelName,
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
 * 1. 加入飞书推送
 * @param {*} url
 * @returns
 */
async function sendPicture({ filePath = '', url = '' }) {
  // console.log(url)
  if (filePath && isInAllowedTime()) {
    const result = await larkClient.sendImage(filePath);
    if (result && result.code == 0) {
      console.log('Lark图片消息发送成功:', result.msg);
    }
  }

  // QQ设置了免打扰
  await sendQQPic({ url, filePath });
}

async function sendQQPic({ filePath = '', url = '' }) {
  const QQ_API = 'http://192.168.31.10:3000/send_group_msg';
  if (!url) {
    console.log('发送图片失败，缺少参数 url', url, filePath);
    return false;
  }
  try {
    const postData = {
      group_id: parseInt(MESSAGE_PUSHER_QQ_GROUP_ID),
      message: [
        {
          type: 'image',
          data: {
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
    if (url) {
      postData.message[0].data.url = url;
    }
    const response = await axios.post(QQ_API, postData).then((res) => res.data);
    if (response && response.retcode == 0) {
      console.log('QQ图片消息发送成功');
    } else {
      console.log('QQ图片消息发送结果:', response.status);
    }
    return response;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    } else {
      throw error;
    }
  }
}

module.exports = { sendMessage, sendPicture };
