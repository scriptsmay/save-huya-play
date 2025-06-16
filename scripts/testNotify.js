require('module-alias/register');
const path = require('path');
const fs = require('fs').promises;

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

// const imgFile = '../logs/screenshot/table-screenshot.20250610_164343.png';

// 获取今日日期字符串
function getTodayDateString() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
}

// 异步查找今日的截图文件
async function findTodayScreenshots() {
  const today = getTodayDateString();
  const screenshotDir = path.join(__dirname, '../logs/screenshot');
  const regexStr = `${today}`;

  try {
    // 检查目录是否存在
    await fs.access(screenshotDir);

    // 读取目录中的所有文件
    const files = await fs.readdir(screenshotDir);

    // 筛选出今日的截图文件
    const todayScreenshots = files.filter((file) => {
      return (
        file.indexOf(regexStr) > -1 &&
        /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file)
      ); // 更全面的图片扩展名
    });

    // 获取文件详细信息
    const filesWithStats = await Promise.all(
      todayScreenshots.map(async (file) => {
        const filePath = path.join(screenshotDir, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
        };
      })
    );

    // 按修改时间排序（最新的在前）
    return filesWithStats.sort((a, b) => b.modified - a.modified);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('截图目录不存在:', screenshotDir);
    } else {
      console.error('查找截图文件时出错:', error);
    }
    return [];
  }
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

// awa testPic();
