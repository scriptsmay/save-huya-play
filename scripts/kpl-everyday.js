/**
 * 写一个脚本，每天早上9点定时抓取今日的赛程，并推送给消息服务
 */

const puppeteer = require('puppeteer');
const config = require('../config/config');
const {
  getTodayDateString,
  getTimestamp,
  timeLog,
  getScreenShotPath,
} = require('./util/index');
const msgService = require('./util/msgService');
// KPL官方赛程

// 2025年夏季赛ID
const leagueId = 20250002;
const todayStr = getTodayDateString('-');
const URL_MATCH_DATA = `https://pvp.qq.com/matchdata/schedule.html?league_id=${leagueId}&match_calendar=${todayStr}`;

const TARGET_SELECTOR = '.schedule-r-item.fixed-position';
const IMAGE_FILENAME = `match-kpl.${getTimestamp()}.png`;
const OUTPUT_FILE = `logs/screenshot/${IMAGE_FILENAME}`;

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: 'new', // 使用新的Headless模式
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // 适用于某些Linux环境
    protocolTimeout: config.protocolTimeout,
  });
  try {
    await mainTask(browser);
  } catch (error) {
    console.error('执行过程中出错:', error.message);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();
  }
})();

async function mainTask(browser) {
  // 打开新页面
  const page = await browser.newPage();
  // 设置视口大小
  await page.setViewport({ width: 1280, height: 800 });

  // 导航到目标URL
  await page.goto(URL_MATCH_DATA, {
    waitUntil: 'networkidle2', // 等待网络空闲
    timeout: 30000, // 30秒超时
  });
  console.log('正在截图...');
  const fileElement = await page.waitForSelector(TARGET_SELECTOR);
  await fileElement.screenshot({
    path: OUTPUT_FILE,
    type: 'png',
  });

  console.log(`表格截图已保存为: ${OUTPUT_FILE}`);
  const url = `http://192.168.31.10:3210/screenshot/${IMAGE_FILENAME}`;

  await msgService
    .sendPicture({ url, filePath: getScreenShotPath(IMAGE_FILENAME) })
    .catch((err) => {
      console.log(err.message);
    });
}
