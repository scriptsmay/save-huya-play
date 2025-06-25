const path = require('path');
const fs = require('fs').promises;

// 可以提取为配置参数
const ALLOWED_HOURS = {
  start: 9, // 9:00
  end: 21, // 21:00
};

// 允许周末发送
const ALLOW_WEEKEND = true;

/**
 * 判断消息免打扰状态
 * @returns {Boolean}
 */
function isInAllowedTime() {
  const now = new Date();
  const hours = now.getHours();
  if (hours < ALLOWED_HOURS.start || hours >= ALLOWED_HOURS.end) {
    console.log(
      `当前时间 ${now.toLocaleTimeString()} 不在允许发送时段 (${
        ALLOWED_HOURS.start
      }:00-${ALLOWED_HOURS.end}:00)`
    );
    return false;
  }
  // 只允许工作日发送
  const day = now.getDay(); // 0是周日，1-6是周一到周六
  if (day === 0 || day === 6) {
    if (!ALLOW_WEEKEND) {
      console.log('今天是周末，不允许周末发送');
      return false;
    }
  }
  return hours >= ALLOWED_HOURS.start && hours < ALLOWED_HOURS.end;
}

let globalMsgContent = '';

/**
 * 增加当前时间的日志打印
 * @param {*} msg
 */
function timeLog(...args) {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const timeStr = `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;

  globalMsgContent += `${timeStr}${args.join(' ')}\n`;

  console.log(timeStr, ...args);
}

function dumpAllMessage() {
  return globalMsgContent;
}

/**
 * 模拟等待n毫秒
 * @param {*} ms
 * @returns
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 当前时间戳字符串
 * @returns 格式为 YYYYMMDD_HHmmss
 */
function getTimestamp() {
  // 获取当前日期和时间并格式化为字符串
  const now = new Date();
  const timestamp =
    now.getFullYear() +
    ('0' + (now.getMonth() + 1)).slice(-2) +
    ('0' + now.getDate()).slice(-2) +
    '_' +
    ('0' + now.getHours()).slice(-2) +
    ('0' + now.getMinutes()).slice(-2) +
    ('0' + now.getSeconds()).slice(-2);
  return timestamp;
}

// 计算今天24点的剩余秒数
function getSecondsUntilMidnight() {
  const now = new Date();
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // 明天
    0,
    0,
    0 // 0时0分0秒
  );
  return Math.floor((todayEnd - now) / 1000);
}

function getScreenShotPath(filename) {
  return path.join(__dirname, '../../logs/screenshot/', filename);
}

// 使用示例
// const claimButtons = await getElementsByText(page, '.task-panel-wrap *', '领取');
// 查找元素的替代方案（兼容旧版）
const getElementsByText = async (page, selector, text) => {
  const elements = await page.$$(selector);
  const filtered = [];

  for (const element of elements) {
    const elementText = await page.evaluate(
      (el) => el.textContent.trim(),
      element
    );
    if (elementText === text) {
      filtered.push(element);
    }
  }

  return filtered;
};

/**
 * 获取今日日期字符串，如 20250520
 * @param {string} split 分隔符，默认为空。例如值为 '-' 则返回 2025-05-20
 * @returns
 */
function getTodayDateString(split = '') {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join(split);
}

// 异步查找今日的截图文件
async function findTodayScreenshots() {
  const screenshotDir = path.join(__dirname, '../../logs/screenshot');
  const regexStr = `${getTodayDateString()}`;

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

module.exports = {
  timeLog,
  sleep,
  getTimestamp,
  dumpAllMessage,
  getScreenShotPath,
  isInAllowedTime,
  getElementsByText,
  getSecondsUntilMidnight,
  findTodayScreenshots,
  getTodayDateString,
};
