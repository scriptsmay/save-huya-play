require('module-alias/register');
const path = require('path');

const msgService = require('./util/msgService');
const {
  timeLog,
  dumpAllMessage,
  findTodayScreenshots,
} = require('./util/index');

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

function getFilePath(filename) {
  return path.join(__dirname, '../logs/screenshot/', filename);
}

async function testPic(filename) {
  // 找到 table-screenshot.20250610_ 以今日日期的图片
  // console.log(filename);
  // const url = `http://192.168.31.10:3210/screenshot/${filename}`;

  await msgService
    .sendPicture({ filePath: getFilePath(filename) })
    .then((res) => {
      console.log('成功', res);
    })
    .catch((err) => {
      console.log(err.message);
    });
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
