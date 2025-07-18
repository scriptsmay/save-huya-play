const puppeteer = require('puppeteer');
const config = require('../config/config');
const redisClient = require('../config/redis');

const douyuUserService = require('./util/douyuUserService');
const { getTimestamp, timeLog, getScreenShotPath } = require('./util/index');
const msgService = require('./util/msgService');

const URL_DOUYU_BADGE_LIST = 'https://www.douyu.com/member/cp/getFansBadgeList';

// 定义URL和选择器
const TABLE_SELECTOR = 'table.fans-badge-list';

const TARGET_FILENAME = `douyu_badge.${getTimestamp()}.png`;
const OUTPUT_FILE = `logs/screenshot/${TARGET_FILENAME}`;

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: 'new', // 使用新的Headless模式
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // 适用于某些Linux环境
    protocolTimeout: config.protocolTimeout,
  });
  try {
    const isLoggedIn = await douyuUserService.userLoginCheck(browser);
    if (!isLoggedIn) {
      timeLog('用户未登录');
      return;
    }

    await mainTask(browser);
  } catch (error) {
    console.error('执行过程中出错:', error.message);
  } finally {
    // 关闭redis,否则会卡住
    await redisClient.disconnect();
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();
  }
})();

/**
 * 主程序执行
 * @param {*} browser
 */
async function mainTask(browser) {
  // 打开新页面
  const page = await browser.newPage();

  // 设置视口大小
  await page.setViewport({ width: 1280, height: 800 });

  // 导航到目标URL
  console.log(`正在访问: ${URL_DOUYU_BADGE_LIST}`);
  await page.goto(URL_DOUYU_BADGE_LIST, {
    waitUntil: 'networkidle2', // 等待网络空闲
    timeout: 30000, // 30秒超时
  });

  // 等待表格加载
  console.log('等待表格加载...');
  await page.waitForSelector(TABLE_SELECTOR, {
    visible: true,
    timeout: 15000,
  });

  // 定位表格元素
  const table = await page.$(TABLE_SELECTOR);
  if (!table) {
    throw new Error('未找到指定的表格元素');
  }

  // 截图表格
  console.log('正在截图表格...');
  await table.screenshot({
    path: OUTPUT_FILE,
    type: 'png',
    // omitBackground: true, // 透明背景
  });

  console.log(`表格截图已保存为: ${OUTPUT_FILE}`);
  const url = `http://192.168.31.10:3210/screenshot/${TARGET_FILENAME}`;

  await msgService
    .sendPicture({ url, filePath: getScreenShotPath(TARGET_FILENAME) })
    .catch((err) => {
      console.log(err.message);
    });
}
