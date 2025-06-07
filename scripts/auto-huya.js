// 本地环境变量
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const { timeLog, sleep } = require('./util/index');
const checkInService = require('./util/checkInService');
const config = require('../config/config');
const presentService = require('./util/presentService');

// 定义目标 URL
const URL_USER = config.URLS.URL_HUYA_USER;
const TARGET_ROOM_LIST = process.env.HUYA_ROOM_LIST.split(',') || [];

// 常量定义
const SELECTORS = config.HUYA_SELECTORS;

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
    await page.goto(URL_USER, {
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
    } else {
      await goTaskCenter(page);

      if (!TARGET_ROOM_LIST.length) {
        console.error('请设置虎牙直播间ID: HUYA_ROOM_LIST');
        return;
      }
      const newPage = await browser.newPage();
      for (const roomId of TARGET_ROOM_LIST) {
        await autoCheckInRoom(newPage, roomId);
      }

      await newPage.close();
    }
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();

    // 关闭redis
    await checkInService.close();
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
 * 每日任务中心签到任务
 * @param {*} page
 */
async function goTaskCenter(page) {
  if (process.env.HUYA_NOCHECKIN == '1') {
    // 跳过签到
    return false;
  }
  const URL_TASK = 'https://hd.huya.com/h5/task_center/index.html';
  try {
    await page.goto(URL_TASK, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    // await sleep(5000);
    await page.waitForSelector('button').catch((err) => {
      timeLog('任务中心：未找到按钮', err.message);
    });
    // 等待并点击“签到”按钮
    await page.click(SELECTORS.SIGN_IN_BTN).catch((err) => {
      timeLog('未找到“签到”按钮，可能已经签过', err.message);
    });

    // .no-alert 7日不再提醒
    await sleep(2000);
    timeLog('任务中心签到完成');
    await page.close();
  } catch (error) {
    console.error('打开任务中心 URL_TASK 发生错误:', error);
  }
}

/**
 * 执行直播间任务
 * @param {*} page
 * @param {*} roomId
 */
async function autoCheckInRoom(page, roomId) {
  if (!roomId) return;
  const URL_ROOM = `https://www.huya.com/${roomId}`;

  try {
    // 1. 导航到房间页
    timeLog(`开始处理房间 ${roomId}`);

    await page
      .goto(URL_ROOM, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      })
      .catch((error) => {
        console.warn(
          `房间 ${roomId} 网络加载超时，但一般没影响`,
          error.message
        );
        return false;
      });

    // 获取页面标题并打印
    const title = await page.title();
    timeLog(`页面标题： ${title}`);

    await roomCheckIn(page, roomId);
    await presentService.room(page, roomId);
  } catch (error) {
    console.error(`房间 ${roomId} 自动打卡过程中发生错误:`, error);
  }
}

/**
 * 直播间自动打卡
 * @param {*} page
 */
async function roomCheckIn(page, roomId) {
  // 检查是否已打卡
  const status = await checkInService.hasCheckedIn(roomId);
  console.log(status);
  if (status.checked) {
    timeLog(`Redis 读取到房间 ${roomId}：已打卡，跳过打卡`);
    await sleep(3000);
    return;
  }

  // 2. 等待徽章元素
  const badgeSelector = SELECTORS.BADGE_SELECTOR;
  await page.waitForSelector(badgeSelector, { timeout: 10000 });

  await sleep(3000);

  // 3. hover徽章
  await page.hover(badgeSelector);
  // console.log(`房间 ${roomId}：hover 粉丝牌`);

  // 4. 等待按钮出现并查找
  await page
    .waitForSelector(`${badgeSelector} a`, { timeout: 10000 })
    .catch(async (err) => {
      timeLog(
        `房间 ${roomId}：未找到按钮 ${badgeSelector} a，请检查页面结构`,
        err.message
      );
      return await page.click(badgeSelector);
    });

  let setRedisCheckIn = false;
  // 获取所有按钮
  const buttons = await page.$$(`${badgeSelector} a`);

  for (const btn of buttons) {
    const text = await btn.evaluate((el) => el.textContent.trim());

    if (text.includes(SELECTORS.CPL_BTN_TEXT)) {
      setRedisCheckIn = true;
      timeLog(`房间 ${roomId}：任务已完成，跳过打卡`);
      break;
    } else if (text.includes(SELECTORS.CHECK_BTN_TEXT)) {
      timeLog(`房间 ${roomId}：开始打卡`);
      await btn.click();
      timeLog(`房间 ${roomId}：每日打卡福利领取成功`);
      setRedisCheckIn = true;

      break;
    }
  }

  if (setRedisCheckIn) {
    // redis记录用户打卡
    const result = await checkInService.setCheckIn(roomId);
    timeLog(result);
  }
}
