// const { Cluster } = require('puppeteer-cluster');
const puppeteer = require('puppeteer');
const { timeLog, sleep } = require('./util/index');
const huyaUserService = require('./util/huyaUserService');
const douyuUserService = require('./util/douyuUserService');
const config = require('../config/config');
const redisClient = require('../config/redis');

const browserOptions = {
  userDataDir: './user_data',
  headless: false,
  args: ['--mute-audio'],
  protocolTimeout: config.protocolTimeout,
};

(async () => {
  const browser = await puppeteer.launch(browserOptions);
  // console.log(await browser.version()); // 单独测试是否能获取版本

  // 添加任务
  const urls = ['https://www.huya.com/kpl', 'https://www.douyu.com/998'];

  const tasks = urls.map((url) => pageTask({ browser, url }, 120));

  // 结果收集
  const results = await Promise.all(tasks);

  // // 正确方式 - 使用 for...of 循环
  // for (const url of urls) {
  //   const result = await pageTask({ browser, url });
  //   results.push(result);
  // }

  timeLog('All tasks completed. Results:', results);
  await browser.close();
  redisClient.disconnect();
})().catch((err) => {
  timeLog('error:', err);
  process.exit(1);
});

async function pageTask(context, timeout = 120) {
  // 正确方式访问browser
  const { browser, url } = context;
  try {
    timeLog(`Starting ${url}`);

    // 浏览器信息
    const browserVersion = await browser.version();
    timeLog(`Using browser ${browserVersion}`);

    // 登录检查
    if (url.includes('huya')) {
      timeLog('Checking huya login...');
      const isLoggedIn = await huyaUserService.userLoginCheck(browser);
      if (!isLoggedIn) {
        timeLog('Huya not logged in');
        return { url, status: 'huya_not_logged_in' };
      }
    } else if (url.includes('douyu')) {
      timeLog('Checking douyu login...');
      const isLoggedIn = await douyuUserService.userLoginCheck(browser);
      if (!isLoggedIn) {
        timeLog('Douyu not logged in');
        return { url, status: 'douyu_not_logged_in' };
      }
    }

    const page = await browser.newPage();
    // 导航
    timeLog(`Navigating to ${url}`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 数据提取
    timeLog('Extracting data...');
    const data = await page.evaluate(() => ({
      title: document.title,
    }));

    // 等待
    timeLog('Waiting for 2 minutes...');
    for (let i = 0; i < timeout; i++) {
      await sleep(1000);
      if (i % 10 === 0) timeLog(`Waited ${i} seconds...`);
    }

    await page.close();

    return { url, ...data, status: 'success' };
  } catch (error) {
    timeLog(`Error in ${url}: ${error.message}`);
    return { url, status: 'error', error: error.message };
  }
}
