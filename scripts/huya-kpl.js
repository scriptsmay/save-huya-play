// 本地环境变量
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const { timeLog, sleep } = require('./util/index');
const config = require('../config/config');

const presentService = require('./util/presentService');

// 常量定义
const SELECTORS = config.HUYA_SELECTORS;

const SELECTOR_BTN_GET = '.hy-mission-btn--get';

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 可视化模式更容易调试
  });
  const page = await browser.newPage();

  // 检查是否有保存的cookies
  if (fs.existsSync('cookies.json')) {
    const cookies = JSON.parse(fs.readFileSync('cookies.json'));
    await browser.setCookie(...cookies);
  }

  try {
    // 打开目标页面
    await page.goto(config.URLS.URL_HUYA_USER, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    const username = await checkLoginStatus(page);
    if (!username) {
      timeLog('正在等待二维码图片加载...60s');
      await page
        .waitForSelector(SELECTORS.QR_IMAGE_ELEMENT, { timeout: 30000 })
        .catch((err) => {
          console.error('等待二维码元素超时:', err);
          return;
        });

      const qrImgUrl = await page
        .$eval(SELECTORS.QR_IMAGE_ELEMENT, (el) => el.getAttribute('src'))
        .catch((err) => {
          console.error('获取二维码地址失败:', err);
          return;
        });
      timeLog('二维码图片地址:', qrImgUrl);
      timeLog('请扫码登录...');
      await page
        .waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
        .catch((err) => {
          console.error('等待页面跳转失败:', err);
        });
      timeLog('检测到页面跳转，用户已登录');

      const cookies = await browser.cookies();
      fs.writeFileSync('cookies.json', JSON.stringify(cookies));
      timeLog('已保存 cookies 到 cookies.json 文件');
    }
    await page.close();

    await startMain(browser);
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();
  }
})();

/**
 * 异步检查登录状态
 *
 * 该函数通过检查页面上是否有特定的用户名称元素来判断用户是否已登录
 * 如果用户已登录，会打印用户名并返回用户名，否则打印用户未登录并返回false
 *
 * @param {Object} page - 一个表示当前页面的对象，用于执行页面操作
 * @returns {Promise<string | boolean>} - 返回用户名（如果已登录）或false（如果未登录）
 */
async function checkLoginStatus(page) {
  // 尝试获取页面上的用户名称元素
  const userElement = await page.$(SELECTORS.USER_NAME_ELEMENT);
  if (userElement) {
    // 获取并打印用户名称
    const username = await page.$eval(SELECTORS.USER_NAME_ELEMENT, (el) =>
      el.textContent.trim()
    );
    timeLog('用户已登录，用户名:', username);
    return username;
  } else {
    // 如果用户名称元素不存在，表示用户未登录
    timeLog('用户未登录');
    return false;
  }
}

/**
 * 主任务线程
 * @param {*} browser
 */
async function startMain(browser) {
  timeLog('开始执行主线程任务...');
  await startKplTask(browser);
}

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
      await livePage.click(SELECTOR_BTN_GET);
      timeLog(`KPL官方直播间：点击领取按钮`);
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
  sleep(1500);

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
      timeout: 10000,
    });

    return page;
  } catch (error) {
    console.error('发生错误:', error);
    return false;
  }
}
