/**
 * 写一个脚本，每天早上9点定时抓取今日的赛程，并推送给消息服务
 */

const puppeteer = require('puppeteer');
const config = require('../config/config');
const { getTimestamp, timeLog, getScreenShotPath } = require('./util/index');
const msgService = require('./util/msgService');

// const SEND_PIC = false;

const URL_MATCH_DATA = 'https://kpl.qq.com/';
const URL_MATCH_DATA_TODAY = 'https://kpl.qq.com/#/Schedule';

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: 'new', // 使用新的Headless模式
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // 适用于某些Linux环境
    protocolTimeout: config.protocolTimeout,
  });
  try {
    // today
    await commonPic(
      browser,
      URL_MATCH_DATA_TODAY,
      '.schedule-main .scroll-wrap'
    );

    // board
    await commonPic(browser, URL_MATCH_DATA, '#floor2');
  } catch (error) {
    console.error('执行过程中出错:', error.message);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();
  }
})();

async function commonPic(browser, url, selectorName) {
  // 打开新页面
  const page = await browser.newPage();
  // 设置视口大小
  await page.setViewport({ width: 1280, height: 800 });

  // 导航到目标URL
  await page.goto(url, {
    waitUntil: 'networkidle2', // 等待网络空闲
    timeout: 30000, // 30秒超时
  });

  // 赛程
  await screenshot(page, selectorName);
}

async function screenshot(page, selectorName) {
  const imageFileName = `kpl_everyday.${getTimestamp()}.png`;
  console.log('正在截图...', selectorName);
  const domElement = await page
    .waitForSelector(`${selectorName}`)
    .catch((err) => {
      console.log(`没有找到这个DOM元素...${selectorName}`, err.message);
      return null;
    });
  if (!domElement) {
    return;
  }
  const result = await domElement
    .screenshot({
      path: `logs/screenshot/${imageFileName}`,
      type: 'png',
    })
    .catch((err) => {
      console.log(`截图出错了...${selectorName}`, err.message);
      return null;
    });
  if (!result) {
    return;
  }

  await msgService
    .sendPicture({
      url: `http://192.168.31.10:3210/screenshot/${imageFileName}`,
      filePath: getScreenShotPath(imageFileName),
    })
    .catch((err) => {
      console.log(err.message);
    });
}
