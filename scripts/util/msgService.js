const fs = require('fs');
const axios = require('axios');
const {
  siteUrl,
  MESSAGE_PUSHER_SERVER,
  MESSAGE_PUSHER_USERNAME,
  MESSAGE_PUSHER_TOKEN,
  MESSAGE_PUSHER_QQ_API,
  MESSAGE_PUSHER_QQ_GROUP_ID = 1034923436,
  MESSAGE_GOTIFY_SERVER,
  MESSAGE_GOTIFY_TOKEN,
} = require('../../config/config');

const { isInAllowedTime } = require('./index');

const larkClient = require('../../config/lark');

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
  const sendContent = `${title}\n\n${content}\nfrom：${siteUrl}`;
  await sendQQMsg({
    text: sendContent,
  });
  await sendGotify({
    title,
    content,
  });
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
      content: sendContent,
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
      console.log('发送消息失败:', error.message);
      // throw error;
      return false;
    }
  }
}

/**
 * 发送图片消息，目前好像只有QQ支持
 * 1. 加入飞书推送 filePath 是飞书推送文件路径
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
  await sendQQMsg({ url });

  // await sendGotify({
  //   filePath,
  //   title: '图片消息',
  //   content: '图片消息',
  // });
}

/**
 * QQ消息推送
 * @param {*} { url = '图片网址', text = '文本内容' }
 * @returns
 */
async function sendQQMsg({ url = '', text = '' }) {
  if (!MESSAGE_PUSHER_QQ_API) {
    return Promise.resolve({
      success: false,
      message: '未配置QQ消息推送服务',
    });
  }
  const QQ_API = `${MESSAGE_PUSHER_QQ_API}/send_group_msg`;
  if (!url && !text) {
    console.log('缺少参数 url / text', url);
    return false;
  }
  try {
    const postData = {
      group_id: parseInt(MESSAGE_PUSHER_QQ_GROUP_ID),
      message: [],
    };
    if (url) {
      postData.message.push({
        type: 'image',
        data: {
          url,
        },
      });
    }
    if (text) {
      postData.message.push({
        type: 'text',
        data: { text },
      });
    }
    const response = await axios.post(QQ_API, postData).then((res) => res.data);
    if (response && response.retcode == 0) {
      console.log('QQ消息发送成功');
    } else {
      console.log('QQ消息发送失败，结果:', response);
    }
    return response;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    } else {
      console.log('发送消息失败:', error.message);
      // throw error;
      return false;
    }
  }
}

/**
 * Gotify消息推送
 * @param {*} param0
 * @returns
 */
async function sendGotify({
  filePath = '',
  title = '图片通知',
  content = '内容',
  markdown = false,
}) {
  const gotifyUrl = `${MESSAGE_GOTIFY_SERVER}/message`;
  const appToken = MESSAGE_GOTIFY_TOKEN;

  try {
    const sendJson = {
      message: content,
      title: title,
      priority: 5, // 优先级：0-10，数字越大优先级越高
      extras: {},
    };
    // 支持 Markdown
    // 不用markdown的时候 \n 换行符才可用
    if (markdown) {
      sendJson.extras['client::display']['contentType'] = 'text/markdown';
    }
    if (filePath) {
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');
      const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
      sendJson.message += `\n![图片](${imageDataUrl})`;
    }
    // console.log('发送Gotify消息:', sendJson);
    const response = await axios.post(gotifyUrl, sendJson, {
      params: {
        token: appToken,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Gotify 通知发送成功:', response.status);
    return response.data;
  } catch (error) {
    console.error(
      'Gotify 发送通知失败:',
      error.response?.status || error.message
    );
    throw error;
  }
}

module.exports = { sendMessage, sendGotify, sendPicture };
