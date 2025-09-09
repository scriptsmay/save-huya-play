// 本地环境变量
const puppeteer = require('puppeteer');
const { timeLog, sleep } = require('./util/index');
const config = require('../config/config');
const redisClient = require('../config/redis');

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
    protocolTimeout: config.protocolTimeout,
  });
  try {
    const isLoggedIn = await huyaUserService.userLoginCheck(browser);
    if (!isLoggedIn) {
      timeLog('虎牙用户未登录');
      return;
    }

    timeLog('开始执行主线程任务...');
    // 实现了多窗口任务同时进行
    await Promise.all([kplCheckIn(browser), startKplTask(browser)]).catch(
      (err) => {
        console.error('发生错误:', err);
      }
    );
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();
  }

  await sleep(5000);

  // 关闭redis,否则会卡住
  await redisClient.disconnect();
})();

/**
 * 主任务线程
 * @param {*} browser
 */
async function startKplTask(browser) {
  timeLog('处理直播任务页面...');
  const taskPage = await openPage(browser, config.URLS.URL_HUYA_TASK_KPL);
  if (!taskPage) {
    return false;
  }

  await taskPage.setViewport({ width: 568, height: 1024 });

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

/**
 * 打开KPL页面停留5分钟
 */
async function kplCheckIn(browser) {
  timeLog('【虎牙KPL】打开页面停留2分钟...');
  const page = await browser.newPage();
  try {
    await page.goto(config.URLS.URL_HUYA_LIVE_KPL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 获取当前页面的标题
    const pageTitle = await page.title();
    timeLog(`【虎牙KPL】页面标题： ${pageTitle}`);

    if (page) {
      // 送礼2个虎粮
      const statusGift = await checkInService.hasGift('kpl');
      if (!statusGift.checked) {
        await presentService.room(page, 'kpl', 2);
      }

      await sleep(5000);
    }
    await sleep(1 * 60000);
    return true;
  } catch (error) {
    console.error('打开虎牙KPL页面发生错误:', error);
    return false;
  }
}

async function findAvailBtns(page) {
  const closeBtn = await page.$('.pop-close');
  if (closeBtn) {
    await closeBtn.click();
    await sleep(1000);
  }
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
      timeout: 30000,
    });

    return page;
  } catch (error) {
    console.error('发生错误:', error);
    return false;
  }
}
