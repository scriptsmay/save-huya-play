// 本地环境变量
require('dotenv').config();
const puppeteer = require('puppeteer');
const { timeLog, sleep } = require('./util/index');
const config = require('../config/config');

const huyaUserService = require('./util/huyaUserService');
const presentService = require('./util/presentService');
const checkInService = require('./util/checkInService');

// 常量定义
const SELECTOR_BTN_GET = '.hy-mission-btn--get';

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 可视化模式更容易调试
    args: ['--mute-audio'], // 全局静音
  });
  try {
    await huyaUserService.userLoginCheck(browser);

    timeLog('开始执行主线程任务...');
    await startKplTask(browser);
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();
  }

  await sleep(5000);

  // 关闭redis,否则会卡住
  await checkInService.close();
})();

/**
 * 主任务线程
 * @param {*} browser
 */
async function startKplTask(browser) {
  const livePage = await openPage(browser, config.URLS.URL_HUYA_LIVE_KPL);

  await sleep(10000);

  // 送礼2个虎粮
  await presentService.room(livePage, 'kpl', 2);

  await sleep(5000);

  timeLog('处理直播任务页面...');
  const taskPage = await openPage(browser, config.URLS.URL_HUYA_TASK_KPL);

  // 找到所有 .hy-mission-btn 的元素，文字如果是 "领取" 的元素，点击它
  const buttons = await taskPage.$$(`.hy-mission-btn`);
  for (const btn of buttons) {
    const text = await btn.evaluate((el) => el.textContent.trim());
    if (text.includes('一键发送')) {
      await btn.click();
      timeLog(`KPL官方直播间：点击一键发送`);
      await sleep(3000);
      break;
    }
  }

  while (true) {
    let avails = await findAvailBtns(taskPage);
    if (avails.length > 0) {
      timeLog(`KPL官方直播间：领取按钮 ${avails.length} 个`);
      await taskPage.waitForSelector(SELECTOR_BTN_GET).catch((err) => {
        timeLog(`未找到元素 ${SELECTOR_BTN_GET}`, err.message);
      });
      timeLog(`点击领取按钮`);
      await taskPage.click(SELECTOR_BTN_GET);
      await sleep(3000);
    } else {
      timeLog('没有可领取的KPL任务...');
      break;
    }
    await sleep(5000);
  }

  await sleep(5000);
}

async function findAvailBtns(page) {
  await page.click('.reward-list-refresh');
  await sleep(1500);

  const buttons = await page.$$(SELECTOR_BTN_GET);
  const claimBtns = [];
  for (const btn of buttons) {
    const text = await btn.evaluate((el) => el.textContent.trim());

    if (text.includes('领取')) {
      claimBtns.push(btn);
      break;
    }
  }
  return claimBtns;
}

async function openPage(browser, url) {
  try {
    const page = await browser.newPage();
    // 打开目标页面
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    return page;
  } catch (error) {
    console.error('发生错误:', error);
    return false;
  }
}
