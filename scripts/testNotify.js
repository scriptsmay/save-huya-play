const path = require('path');

const msgService = require('./util/msgService');
const {
  timeLog,
  dumpAllMessage,
  findTodayScreenshots,
  getTodayDateString,
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

async function testGotifyPic(filename) {
  await msgService
    .sendGotify({
      filePath: getFilePath(filename),
      title: '今日截图' + getTodayDateString('-'),
      content: '截图内容',
    })
    .catch((err) => {
      console.log(err.message);
    });
}

async function testPicSender(filename) {
  await msgService
    .sendPicture({
      filePath: getFilePath(filename),
    })
    .catch((err) => {
      console.log(err.message);
    });
}

// 使用示例
async function testTodayScreenshots() {
  const todayScreenshots = await findTodayScreenshots();
  if (todayScreenshots.length > 0) {
    console.log(`找到 ${todayScreenshots.length} 个今日截图:`);
    todayScreenshots.forEach((file, index) => {
      console.log(
        `${index + 1}. ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
      );
    });

    await testGotifyPic(todayScreenshots[0].name);

    if (process.env.TEST_LARK) {
      await testPicSender(todayScreenshots[0].name);
    }
  } else {
    console.log('未找到今日的截图文件');
  }
}

if (process.env.TEST_LARK) {
  const larkClient = require('../config/lark');
  async function testLark(imgFile) {
    const imgPath = path.resolve(__dirname, imgFile);
    const imgRes = await larkClient.sendImage(imgPath);
    console.log('图片消息发送成功:', imgRes);
  }
  testLark();
}

if (process.env.TEST_TEXT) {
  testText();
}

if (process.env.TEST_PIC) {
  testTodayScreenshots();
}
