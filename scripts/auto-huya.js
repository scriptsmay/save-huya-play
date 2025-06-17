// 本地环境变量
const puppeteer = require('puppeteer');
const redisClient = require('../config/redis');

const {
  timeLog,
  sleep,
  dumpAllMessage,
  getElementsByText,
} = require('./util/index');
const checkInService = require('./util/checkInService');
const config = require('../config/config');
const huyaUserService = require('./util/huyaUserService');
const presentService = require('./util/presentService');
const msgService = require('./util/msgService');

// 定义目标 URL
const TARGET_ROOM_LIST = config.HUYA_ROOM_LIST.split(',') || [];
const totalRoomCount = TARGET_ROOM_LIST.length;
let roomCount = 0;

// 常量定义
const SELECTORS = config.HUYA_SELECTORS;

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 可视化模式更容易调试
    args: ['--mute-audio'], // 全局静音
  });

  try {
    const isLoggedIn = await huyaUserService.userLoginCheck(browser);
    if (!isLoggedIn) {
      timeLog('虎牙用户未登录');
      return;
    }

    await goH5CheckIn(browser);

    if (!totalRoomCount) {
      console.error('请设置虎牙直播间ID: HUYA_ROOM_LIST');
      return;
    }
    timeLog(`共需要打卡的虎牙直播间：${totalRoomCount}个`);
    let newPage = await browser.newPage();
    for (const roomId of TARGET_ROOM_LIST) {
      if (roomCount == 5) {
        await sleep(3000);
        await newPage.close();
        timeLog('已打开5个页面，先关闭页面，等待60s再继续操作，以增加容错...');
        await sleep(60000);
        newPage = await browser.newPage();
      }
      await autoCheckInRoom(newPage, roomId);
    }
    await newPage.close();

    // 虎牙PC任务中心
    await pcTaskCenter(browser);
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();

    // 关闭redis
    await redisClient.disconnect();

    // 启用通知服务
    await msgService.sendMessage('虎牙打卡任务', dumpAllMessage()).then(() => {
      console.log('消息推送成功');
    });
  }
})();

/**
 * 每日任务中心签到
 * @param {*} browser
 */
async function goH5CheckIn(browser) {
  if (process.env.HUYA_NOCHECKIN == '1') {
    // 跳过签到
    return false;
  }
  const page = await browser.newPage();
  const URL_TASK = config.URLS.URL_HUYA_H5_CHECKIN;
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
  } catch (error) {
    console.error('打开任务中心 URL_TASK 发生错误:', error);
  }
  await page.close();
}

/**
 * pc任务中心白嫖积分
 * @param {*} browser
 */
async function pcTaskCenter(browser) {
  const page = await browser.newPage();
  try {
    await page.goto(config.URLS.URL_HUYA_TASK_CENTER, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    const point = await page.$eval(
      config.HUYA_SELECTORS.HUYA_POINTS,
      (el) => el.textContent
    );
    timeLog(`当前积分：${point}`);

    // 等待任务面板加载
    await page.waitForSelector('.task-panel-wrap');
    timeLog('任务面板已加载');
    await sleep(1000); // 等待1秒防止过快点击

    while (true) {
      let claimButtons = await getElementsByText(
        page,
        '.task-panel-wrap div',
        '领取'
      );
      timeLog(`找到${claimButtons.length}个"领取"按钮`);
      if (claimButtons.length === 0) {
        break;
      }
      await claimButtons[0].click();
      await sleep(3000); // 添加一个延迟，防止过快点击
    }

    await page.close();

    timeLog('PC任务中心自动任务完成');
  } catch (error) {
    console.error(
      `打开任务中心 ${config.URLS.URL_HUYA_TASK_CENTER} 发生错误:`,
      error.message
    );
  }
  await page.close();
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
  // console.log(status);
  if (status.checked) {
    roomCount += 1;
    timeLog(
      `Redis 读取到房间 ${roomId}：已打卡，跳过打卡...[${roomCount}/${totalRoomCount}]`
    );
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
      timeLog(
        `房间 ${roomId}：已完成，跳过打卡 [${roomCount}/${totalRoomCount}]`
      );
      break;
    } else if (text.includes(SELECTORS.CHECK_BTN_TEXT)) {
      timeLog(`房间 ${roomId}：开始打卡...[${roomCount}/${totalRoomCount}]`);
      await btn.click();
      timeLog(`房间 ${roomId}：每日打卡福利领取成功`);
      setRedisCheckIn = true;

      break;
    }
  }

  if (setRedisCheckIn) {
    // redis记录用户打卡
    await checkInService.setCheckIn(roomId);
    // timeLog(result);
    roomCount += 1;
  }
}
