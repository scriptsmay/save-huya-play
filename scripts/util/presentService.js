const { timeLog, sleep, getSecondsUntilMidnight } = require('./index');
const config = require('../../config/config');
const redisClient = require('../../config/redis');
const checkInService = require('./checkInService');

// 常量定义
const SELECTORS = config.HUYA_SELECTORS;
const GIFT_URL_STR = 'webPackageV2';
const GIFT_FREE_TEXT = '虎粮';
const GIFT_KPL_TEXT = '稳住 能赢';

const GIFT_SUPER_TEXT = '超粉虎粮';

const DEFAULT_PRESENT_NUM = +config.HUYA_ROOM_HULIANG_NUM || 10;
/**
 * 直播间赠送虎粮，可以指定免费虎粮礼物数量
 * @param {*} page 必填
 * @param {*} roomId 必填
 * @param {*} presentNum 可选，默认为10，填了之后不会判断有没有送过礼物，会强制赠送
 */
async function roomPresents(page, roomId, presentNum) {
  // 检查是否已送礼， 如果指定 presentNum ，则不判断
  const status = await checkInService.hasGift(roomId);
  if (status.checked && !presentNum) {
    // timeLog(`房间 ${roomId}：已赠送虎粮，跳过赠送`);
    await sleep(3000);
    return;
  }
  console.log(`房间 ${roomId}：开始进行免费礼物赠送`);

  try {
    const frame = await getTheIframe(page, roomId);

    if (!frame) {
      console.log(`房间 ${roomId}：未找到礼物iframe`);
      return false;
    }

    await frame
      .waitForSelector('.g-package-list', { timeout: 30000 })
      .catch((err) => {
        console.warn(`房间 ${roomId}：未找到礼物box`, err.message);
      });
    const freeNum = presentNum || DEFAULT_PRESENT_NUM;
    await sendRoomGift(roomId, frame, freeNum);

    // 点击关闭
    await sleep(3000);
    await page.locator('.dlg-close[title="关闭"]').click();
    await sleep(3000);
  } catch (error) {
    console.error(`房间 ${roomId} 礼物赠送失败：`, error.message);
  }
}

async function getAvailableGifts(frame) {
  const giftIcons = await frame.$$(SELECTORS.PRESENT_BTN);
  const availableGifts = { super: [], free: [] };

  for (const giftIcon of giftIcons) {
    const text = await giftIcon.evaluate(
      (el) => el.querySelector('p')?.textContent.trim() || ''
    );

    if (text === GIFT_SUPER_TEXT) {
      availableGifts.super.push(giftIcon);
    } else if (text === GIFT_FREE_TEXT || text === GIFT_KPL_TEXT) {
      availableGifts.free.push(giftIcon);
    }
  }
  return availableGifts;
}
/**
 * 赠送虎粮
 * @param {*} roomId
 * @param {*} frame
 * @param {*} giftIcon
 * @param {*} text
 * @param {*} count
 * @returns
 */
async function sendGiftAndRefresh(roomId, frame, giftIcon, text, count) {
  try {
    // timeLog(`房间 ${roomId}：赠送 ${text}，数量 ${count}`);
    await giftIcon.hover();
    await submitGift(roomId, frame, count);
    // 赠送后 DOM 可能变化，需要重新获取
    return await getAvailableGifts(frame);
  } catch (err) {
    console.log(`赠送 ${text} 失败:`, err.message);
    return await getAvailableGifts(frame); // 即使失败也要刷新
  }
}

/**
 * 执行赠送虎粮
 * @param {*} roomId
 * @param {*} page
 * @param {number | string} count 礼物数量
 */
async function submitGift(roomId, page, count) {
  timeLog(`房间 ${roomId}：开始赠送礼物`);

  // 确保弹出层弹出
  await page
    .waitForSelector(SELECTORS.PRESENT_POPUP, { timeout: 30000 })
    .catch((err) => {
      console.warn(`房间 ${roomId}：ERROR  未找到礼物弹出层`, err.message);
    });
  // 选择input框输入赠送数量
  await page.click(SELECTORS.PRESENT_INPUT);
  await sleep(1000);
  await page.type(SELECTORS.PRESENT_INPUT, count.toString());
  await sleep(1000);

  await page
    .waitForSelector(SELECTORS.PRESENT_SUBMIT, { timeout: 10000 })
    .then(async () => {
      // 点击赠送按钮
      // timeLog(`房间 ${roomId}：点击赠送按钮`);
      await page.click(SELECTORS.PRESENT_SUBMIT);

      // timeLog(`房间 ${roomId}：赠送成功 ${count} 个`);
      await checkInService.setGift(roomId);
    })
    .catch((err) => {
      console.warn(`房间 ${roomId}：等待赠送按钮超时`, err.message);
    });

  await sleep(10000);
}

/**
 * 处理礼物frame页面的逻辑
 * @param {*} roomId
 * @param {*} frame
 */
async function sendRoomGift(roomId, frame, presentNum) {
  let availableGifts = await getAvailableGifts(frame);
  // console.log(`礼物查询结果:`, availableGifts);

  // 1. 先送超级礼物
  while (availableGifts.super.length > 0) {
    const giftIcon = availableGifts.super[0];
    const realCount = await giftIcon.evaluate(
      (btn) => btn.querySelector('.c-count')?.textContent.trim() || '0'
    );
    availableGifts = await sendGiftAndRefresh(
      roomId,
      frame,
      giftIcon,
      GIFT_SUPER_TEXT,
      realCount
    );
  }

  // 2. 再送免费礼物
  if (availableGifts.free.length > 0) {
    const giftIcon = availableGifts.free[0];
    const realCount = await giftIcon.evaluate(
      (btn) => btn.querySelector('.c-count')?.textContent.trim() || '0'
    );
    timeLog(`查询到 '${GIFT_FREE_TEXT}' 数量 ${realCount} 个`);

    const giftCount = Math.min(parseInt(realCount, 10), presentNum);
    availableGifts = await sendGiftAndRefresh(
      roomId,
      frame,
      giftIcon,
      GIFT_FREE_TEXT,
      giftCount
    );

    const leftCount = realCount - giftCount;

    // 把虎粮数量存起来，基本都是12点过期
    await redisClient.set(`huya:giftNum`, leftCount, {
      EX: getSecondsUntilMidnight(),
    });
  }
}

/**
 * 找到弹出的 iframe
 * @param {*} page
 * @returns
 */
async function getTheIframe(page, roomId) {
  // const iconBag = SELECTORS.ICON_BAG;
  await page
    .locator(SELECTORS.ICON_BAG, { timeout: 10000 })
    .click()
    .catch((err) => {
      console.warn(`房间 ${roomId}：未找到包裹图标`, err.message);
    });

  await sleep(10000);
  let frame = findFrame(page.mainFrame(), GIFT_URL_STR);
  if (!frame) {
    await page.click(SELECTORS.ICON_BAG);
    await sleep(5000);
    frame = findFrame(page.mainFrame(), GIFT_URL_STR);
  }

  return frame;
}

/**
 * 查找指定url的frame
 * @param {*} frame
 * @param {*} urlstr
 */
function findFrame(frame, urlstr) {
  if (frame.url().includes(urlstr)) {
    // console.log(`[找到frame] ${frame.url()}`);
    return frame;
  }
  for (let child of frame.childFrames()) {
    const result = findFrame(child, urlstr);
    if (result) {
      return result;
    }
  }
  return null;
}

/**
 * 测试 iframe  页面
 * @param {*} iframePage
 */
async function debugIframe(iframePage) {
  // 1. 确认 iframe 已加载
  console.log('iframe URL:', await iframePage.url());

  // 2. 检查选择器是否存在
  const selectorExists = await iframePage.evaluate((selector) => {
    const el = document.querySelector(selector);
    console.log('调试元素:', el); // 浏览器控制台可见
    return el !== null;
  }, SELECTORS.PRESENT_BTN);

  console.log('选择器匹配:', selectorExists);

  // 3. 打印 HTML 结构
  console.log('iframe HTML:', await iframePage.content());

  // 4. 尝试简化查询
  const testResults = await iframePage.$$eval('*', (els) =>
    els.map((el) => el.tagName)
  );
  console.log('测试查询:', testResults);
}

function dumpFrameTree(frame, indent) {
  console.log(indent + frame.url());
  console.log(`Frame attrs:`, {
    url: frame.url(),
    name: frame.name(),
    isDetached: frame.isDetached(),
  });
  for (let child of frame.childFrames()) dumpFrameTree(child, indent + '  ');
}

/**
 * 从redis中获取虎粮数量
 * @returns {number}
 */
async function getLeftGiftNum() {
  return await redisClient.get('huya:giftNum');
}

module.exports = {
  room: roomPresents,
  debugIframe,
  dumpFrameTree,
  getLeftGiftNum,
};
