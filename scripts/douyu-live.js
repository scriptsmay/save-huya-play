/**
 * 斗鱼直播间处理粉丝牌打卡任务
 */
const puppeteer = require('puppeteer');
const {
  timeLog,
  sleep,
  dumpAllMessage,
  getTimestamp,
  getScreenShotPath,
} = require('./util/index');
const redisClient = require('../config/redis');

const douyuUserService = require('./util/douyuUserService');
const msgService = require('./util/msgService');
const checkInService = require('./util/checkInService');
const config = require('../config/config');

// gemini的直播间
const LIVE_ROOM_ID = '36252';
const URL_DOUYU_LIVE_PAGE = `https://www.douyu.com/${LIVE_ROOM_ID}`;

// const GIFT_PANEL_SELECTOR = '.BackpackInfoPanel';
// const SELECTORS = {
//   PANEL: '.BackpackInfoPanel',
//   GIFT_NAME: '.BackpackInfoPanel-name',
//   EXPIRE_TEXT: '.BackpackInfoPanel-expiry',
//   // 全部btn
//   COUNT_BTN: '.BackpackInfoPanelBatchProp-content',
//   SEND_BTN: '.BackpackInfoPanelBatchProp-sendButton',
// };

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 可视化模式更容易调试
    args: ['--mute-audio'], // 全局静音
    protocolTimeout: config.protocolTimeout,
  });

  try {
    const isLoggedIn = await douyuUserService.userLoginCheck(browser);
    if (!isLoggedIn) {
      timeLog('斗鱼用户未登录');
      return;
    }

    await sleep(5000);

    await goMainTask(browser);
  } catch (error) {
    console.error('发生错误:', error.message);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();

    // 关闭redis
    await redisClient.disconnect();

    if (config.NODE_ENV == 'production') {
      // 启用通知服务
      await msgService
        .sendMessage('斗鱼直播间赠送任务', dumpAllMessage())
        .then(() => {
          console.log('消息推送成功');
        });
    }
  }
})();

// 去直播间打卡
async function goMainTask(browser) {
  let page = await browser.newPage();

  try {
    await page.goto(URL_DOUYU_LIVE_PAGE, {
      waitUntil: 'domcontentloaded',
      // waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await sleep(15000);
    // 获取页面标题并打印
    const title = await page.title();
    timeLog(`页面标题： ${title}`);
    await page.close();
    await sleep(15000);

    // 检查是否已打卡
    const status = await checkInService.hasCheckedIn(LIVE_ROOM_ID, 'douyu');
    // console.log(status);
    if (status.checked) {
      timeLog(`房间 ${LIVE_ROOM_ID} 已打卡，跳过执行`);
    } else {
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      await page.goto(URL_DOUYU_LIVE_PAGE, {
        waitUntil: 'domcontentloaded',
        // waitUntil: 'networkidle2',
        timeout: 30000,
      });
      await sleep(10000);
      await roomCheckIn(page, LIVE_ROOM_ID);
    }
    // await roomCheckIn(page, LIVE_ROOM_ID);

    await sleep(10000);
  } catch (error) {
    console.error(`打开 URL 发生错误:`, error);
    if (process.env.NODE_ENV == 'production') {
      await goScreenShot(page);
    }
  }

  await sleep(5000);

  await page.close();
}

async function goScreenShot(page) {
  const TARGET_FILENAME = `douyu_room_check.${getTimestamp()}.png`;
  const OUTPUT_FILE = `logs/screenshot/${TARGET_FILENAME}`;
  // 设置视口大小
  await page.setViewport({ width: 1280, height: 800 });
  await page.screenshot({ path: OUTPUT_FILE });

  console.log(`截图已保存为: ${OUTPUT_FILE}`);
  const url = `http://192.168.31.10:3210/screenshot/${TARGET_FILENAME}`;
  await msgService
    .sendPicture({ url, filePath: getScreenShotPath(TARGET_FILENAME) })
    .then((res) => {
      console.log('成功', res);
    })
    .catch((err) => {
      console.log(err.message);
    });

  await sleep(5000);
}

/**
 * 自动赠送每日荧光棒
 * @param {*} page
 */
async function roomCheckIn(page, roomId) {
  // const BADGE_SELECTOR = '.FansMedalPanel-enter';
  const PACKAGE_BTN_SELECTOR = '.BackpackButton';
  const GIFT_ITEM_SELECTOR = '.Backpack-prop.is-effect';
  const giftCountSelector = `${GIFT_ITEM_SELECTOR} .Backpack-propCount`;

  // 第一次进入直播间会有个弹框提示，先刷新页面
  await page.reload();
  await sleep(10000);

  // 点击背包
  await page.locator(PACKAGE_BTN_SELECTOR).click();
  await sleep(5000);

  const result = await page
    .waitForSelector(GIFT_ITEM_SELECTOR)
    .catch(async () => {
      return false;
    });
  if (!result) {
    await page.click(PACKAGE_BTN_SELECTOR);
    await sleep(5000);
  }

  // 礼物数量
  const giftCount = await page.evaluate((selector) => {
    const countEl = document.querySelector(selector);
    return countEl?.textContent.trim() || '';
  }, giftCountSelector);
  timeLog(`${roomId} 礼物数量：${giftCount}`);

  // 普通荧光棒点击赠送n次
  for (let i = 0; i < parseInt(giftCount); i++) {
    await page.locator(GIFT_ITEM_SELECTOR).click();
    console.log(`${roomId}：点击 ${i + 1}/${giftCount}`);
    await sleep(1500); // 500ms 间隔
  }

  // await page.locator(GIFT_ITEM_SELECTOR).click();
  await sleep(1000);
  timeLog(`${roomId}：已赠送 ${giftCount}`);
  await checkInService.setCheckIn(roomId, 'douyu');
}
