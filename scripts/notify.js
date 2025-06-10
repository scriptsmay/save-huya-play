const path = require('path');

const msgService = require('./util/msgService');
const { timeLog, dumpAllMessage } = require('./util/index');

timeLog('开始推送消息...');

if (process.env.TEST_TEXT) {
  testText();
}
async function testText() {
  return msgService
    .sendMessage('通知', dumpAllMessage())
    .then((res) => {
      if (res.success) {
        console.log('推送成功:', res);
      } else {
        console.log('推送失败:', res);
      }
    })
    .catch((err) => {
      console.log(err.message);
    });
}

const imgFile = '../logs/screenshot/table-screenshot.20250610_164137.png';

async function testPic() {
  const outputFile = path.resolve(__dirname, imgFile);
  console.log(outputFile);

  await msgService
    .sendPicture(outputFile)
    .then((res) => {
      console.log('成功', res);
    })
    .catch((err) => {
      console.log(err.message);
    });
}

testPic();
