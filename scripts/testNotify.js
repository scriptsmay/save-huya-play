const path = require('path');

const msgService = require('./util/msgService');
const {
  timeLog,
  dumpAllMessage,
  findTodayScreenshots,
} = require('./util/index');

timeLog('开始推送消息...');
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

function getFilePath(filename) {
  return path.join(__dirname, '../logs/screenshot/', filename);
}

async function testPic(filename) {
  // await msgService
  //   .sendPicture({ filePath: getFilePath(filename) })
  //   .then((res) => {
  //     console.log('成功', res);
  //   })
  //   .catch((err) => {
  //     console.log(err.message);
  //   });

  await testLark(getFilePath(filename));
}

// 使用示例
(async () => {
  const todayScreenshots = await findTodayScreenshots();
  if (todayScreenshots.length > 0) {
    console.log(`找到 ${todayScreenshots.length} 个今日截图:`);
    todayScreenshots.forEach((file, index) => {
      console.log(
        `${index + 1}. ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
      );
    });

    await testPic(todayScreenshots[0].name);
  } else {
    console.log('未找到今日的截图文件');
  }
})();

const larkClient = require('../config/lark');
async function testLark(imgFile) {
  const imgPath = path.resolve(__dirname, imgFile);
  const imgRes = await larkClient.sendImage(imgPath);
  console.log('图片消息发送成功:', imgRes);
}

if (process.env.TEST_TEXT) {
  testText();
}
