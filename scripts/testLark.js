const larkClient = require('../config/lark');
const path = require('path');

(async () => {
  try {
    // const result = await larkClient.sendMessage('测试文字消息');
    // console.log('消息发送成功:', result);

    const imgFile = '../logs/screenshot/table-screenshot.20250610_164343.png';
    const imgPath = path.resolve(__dirname, imgFile);
    const imgRes = await larkClient.sendImage(imgPath);
    console.log('图片消息发送成功:', imgRes);
  } catch (error) {
    console.error('测试失败:', error);
  }
})();
