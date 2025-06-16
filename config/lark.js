/**
 * 飞书应用sdk模块
 */

/**
 * 统一配置文件
 */
const config = require('./config');
const fs = require('fs');
const axios = require('axios');
const lark = require('@larksuiteoapi/node-sdk');

const {
  LARK_APP_ID = '',
  LARK_APP_SECRET = '',
  LARK_APP_TYPE = 'open_id',
  LARK_APP_TARGET_ID = '',
} = config;

// 开发者复制该Demo后，需要修改Demo里面的"app id", "app secret"为自己应用的appId, appSecret
const client = new lark.Client({
  appId: LARK_APP_ID,
  appSecret: LARK_APP_SECRET,
  // disableTokenCache为true时，SDK不会主动拉取并缓存token，这时需要在发起请求时，调用lark.withTenantToken("token")手动传递
  // disableTokenCache为false时，SDK会自动管理租户token的获取与刷新，无需使用lark.withTenantToken("token")手动传递token
  // disableTokenCache: false,
});

//处理免登请求，返回用户的user_access_token
async function getUserAccessToken() {
  //【请求】app_access_token：https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/auth/app_access_token_internal
  console.log(
    '接入服务方第③ 步: 根据AppID和App Secret请求应用授权凭证app_access_token'
  );
  const internalRes = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
    {
      app_id: LARK_APP_ID,
      app_secret: LARK_APP_SECRET,
    },
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (!internalRes.data) {
    return {
      code: 500,
      message: 'app_access_token request error',
      data: null,
    };
  }
  if (internalRes.data.code != 0) {
    //非0表示失败
    return {
      code: internalRes.data.code,
      message: `app_access_token request error: ${internalRes.data.msg}`,
      data: null,
    };
  }
  console.log('接入服务方第④ 步: 获得颁发的应用授权凭证app_access_token');
  const app_access_token = internalRes.data.app_access_token || '';
  return {
    code: 0,
    message: 'success',
    data: app_access_token,
  };
}

/**
 * 发送文字消息
 * @param {*} content
 * @returns
 */
async function sendMessage(content) {
  // 通过 Client 调用「发送消息」接口
  const res = await client.im.message.create({
    params: {
      receive_id_type: LARK_APP_TYPE,
    },
    data: {
      receive_id: LARK_APP_TARGET_ID,
      content: JSON.stringify({
        text: `${content}\nFrom: ${config.siteUrl}`,
      }),
      msg_type: 'text',
    },
  });
  return res;
}

async function sendImage(filePath) {
  const imageKey = await updateImage(filePath);
  if (!imageKey) {
    return {
      code: 500,
      message: 'updateImage error',
      data: null,
    };
  }
  // 通过 Client 调用「发送消息」接口
  const res = await client.im.message.create({
    params: {
      receive_id_type: LARK_APP_TYPE,
    },
    data: {
      receive_id: LARK_APP_TARGET_ID,
      content: JSON.stringify({
        image_key: `${imageKey}`,
      }),
      msg_type: 'image',
    },
  });
  return res;
}

/**
 * 上传图片，返回 image_key
 *
 * @param {*} filePath
 * @returns
 */
async function updateImage(filePath) {
  console.log('path', filePath);
  const res = await client.im.v1.image
    .create({
      data: {
        image_type: 'message',
        image: fs.createReadStream(filePath),
      },
    })
    .then((res) => {
      // 返回数据结构：
      // { "image_key": "img_v2_xxx" }
      console.log('Lark updateImageResult', res);
      if (res) {
        return res['image_key'];
      }
      return false;
    })
    .catch(() => {
      // console.error(e);
      return false;
    });
  return res;
}

/**
 * 上传文件，返回 file_key
 * @param {*} filePath
 * @returns
 */
async function updateFile(filePath) {
  const fileType = filePath.split('.').pop();
  const fileName = filePath.split('/').pop();
  const res = await client.im.file
    .create({
      data: {
        file_type: fileType,
        file_name: fileName,
        file: fs.createReadStream(filePath),
      },
    })
    .then((res) => {
      // 返回数据结构：
      // {
      //     "code": 0,  // 错误码，非 0 表示失败
      //     "data": {
      //         "file_key": "file_456a92d6-c6ea-xxx"
      //     },
      //     "msg": "success"
      // }
      console.log('updateFile', res);
      if (res && res.code == 0) {
        return res.data['file_key'];
      }
      console.log('updateFile error', res && res.msg);
      return false;
    })
    .catch((e) => {
      console.error(JSON.stringify(e.response.data, null, 4));
      return false;
    });
  return res;
}

module.exports = {
  sendMessage,
  getUserAccessToken,
  updateFile,
  updateImage,
  sendImage,
};
