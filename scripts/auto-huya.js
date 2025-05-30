// 本地环境变量
require('dotenv').config();

const puppeter = require('puppeteer');
const fs = require('fs');

// 定义目标 URL
const URL_USER = 'https://i.huya.com/';
const TARGET_ROOM_LIST = process.env.HUYA_ROOM_LIST.split(',') || [];
const DEFAULT_PRESENT_NUM = process.env.HUYA_ROOM_HULIANG_NUM || 10;

// 常量定义
const SELECTORS = {
  USER_NAME_ELEMENT: '.uesr_n',
  QR_IMAGE_ELEMENT: '#qr-image',
  BADGE_SELECTOR: '#chatHostPic',
  CHECK_BTN_TEXT: '打卡',
  CPL_BTN_TEXT: '已完成',
  // 礼物包裹图标
  ICON_BAG: '#player-package-btn',
  PRESENT_BTN: '.m-gift-item',
  PRESENT_POPUP: '.g-present-content',
  PRESENT_INPUT: 'input[type="number"]',
  PRESENT_SUBMIT: '.c-send'
};

const GIFT_URL_STR = 'webPackageV2'
const GIFT_FREE_TEXT = '虎粮';
const GIFT_SUPER_TEXT = '超粉虎粮';

// 公共变量：虎粮总数
let globalPresentNum = 0;
let presentInit = false;

(async () => {
  // 启动浏览器
  const browser = await puppeter.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false // 可视化模式更容易调试
  });
  const page = await browser.newPage();

  // 检查是否有保存的cookies
  if (fs.existsSync('cookies.json')) {
    const cookies = JSON.parse(fs.readFileSync('cookies.json'));
    await browser.setCookie(...cookies);
  }

  try {
    // 打开目标页面
    await page.goto(URL_USER, { waitUntil: 'domcontentloaded', timeout: 10000 });

    const username = await checkLoginStatus(page);
    if (!username) {
      console.log('正在等待二维码图片加载...60s');
      await page.waitForSelector(SELECTORS.QR_IMAGE_ELEMENT, { timeout: 30000 }).catch(err => {
        console.error('等待二维码元素超时:', err);
        return;
      });

      const qrImgUrl = await page.$eval(SELECTORS.QR_IMAGE_ELEMENT, el => el.getAttribute('src')).catch(err => {
        console.error('获取二维码地址失败:', err);
        return;
      });
      console.log('二维码图片地址:', qrImgUrl);
      console.log('请扫码登录...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(err => {
        console.error('等待页面跳转失败:', err);
      });
      console.log('检测到页面跳转，用户已登录');

      const cookies = await browser.cookies();
      fs.writeFileSync('cookies.json', JSON.stringify(cookies));
      console.log('已保存 cookies 到 cookies.json 文件');
    } else {
      await goTaskCenter(page);
      if (!TARGET_ROOM_LIST.length) {
        console.error('请设置虎牙直播间ID: HUYA_ROOM_LIST');
        return;
      }
      for (const roomId of TARGET_ROOM_LIST) {
        await autoCheckInRoom(browser, roomId);
      }
    }

  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 最后打印个时间戳
    console.log(new Date().toLocaleString(), '所有任务完成，正在关闭浏览器...');
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
    const username = await page.$eval(SELECTORS.USER_NAME_ELEMENT, el => el.textContent.trim());
    console.log('用户已登录，用户名:', username);
    return username;
  } else {
    // 如果用户名称元素不存在，表示用户未登录
    console.log('用户未登录');
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
    await page.goto(URL_TASK, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForNetworkIdle({ timeout: 10000 }).catch((err) => {
      console.log('任务中心无事发生');
    });
    console.log('任务中心签到完成');
  } catch (error) {
    console.error('打开任务中心 URL_TASK 发生错误:', error);
  }
}

/**
 * 执行直播间任务
 * @param {*} page 
 * @param {*} roomId 
 */
async function autoCheckInRoom(browser, roomId) {
  const URL_ROOM = `https://www.huya.com/${roomId}`;

  try {
    // 1. 导航到房间页
    console.log(`开始处理房间 ${roomId}`);
    const page = await browser.newPage();
    await page.goto(URL_ROOM, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    }).catch(error => {
      console.warn(`房间 ${roomId} 网络加载超时，但一般没影响`);
      return false;
    });

    await roomCheckIn(page, roomId);
    await roomPresents(page, browser, roomId);

  } catch (error) {
    console.error(`房间 ${roomId} 自动打卡过程中发生错误:`, error);
  }
}

/**
 * 直播间自动打卡
 * @param {*} page 
 */
async function roomCheckIn(page, roomId) {
  // 2. 等待徽章元素
  const badgeSelector = SELECTORS.BADGE_SELECTOR;
  await page.waitForSelector(badgeSelector, { timeout: 10000 });

  // 3. hover徽章
  await page.hover(badgeSelector);
  console.log(`房间 ${roomId}：hover 粉丝牌`);

  // 4. 等待按钮出现并查找
  await page.waitForSelector(`${badgeSelector} a`, { timeout: 10000 }).catch(err => {
    console.log(`房间 ${roomId}：未找到按钮，请检查页面结构`);
    return page.hover(badgeSelector);
  });

  // 获取所有按钮
  const buttons = await page.$$(`${badgeSelector} a`);

  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent.trim());

    if (text.includes(SELECTORS.CPL_BTN_TEXT)) {
      console.log(`房间 ${roomId}：任务已完成，跳过打卡`);
      break;
    } else if (text.includes(SELECTORS.CHECK_BTN_TEXT)) {
      console.log(`房间 ${roomId}：开始打卡`);
      await btn.click();
      console.log(`房间 ${roomId}：每日打卡福利领取成功`);
      break;
    }
  }
}

/**
 * 直播间赠送虎粮
 * @param {*} page 
 */
async function roomPresents(page, browser, roomId) {
  if (presentInit && !globalPresentNum) {
    console.log(`已经没有免费虎粮了，不再进行赠送`)
    return false;
  }
  console.log(`房间 ${roomId}：开始进行赠送普通虎粮`)

  let iframePage = await getTheIframe(page, roomId);

  if (!iframePage) {
    return false;
  }
  // await debugIframe(iframePage);
  // console.log(`房间 ${roomId}：iframe url--> ${iframePage.url()}`);
  const frame = iframePage; // 更名以避免误解

  await frame.waitForSelector('.g-package-list', { timeout: 3000 }).catch((err) => {
    console.warn(`房间 ${roomId}：未找到礼物box`, err);
  });
  try {
    // 先等待目标元素出现
    // await frame.waitForSelector(SELECTORS.PRESENT_BTN, { timeout: 5000 }).catch((err) => {
    //   console.warn(`房间 ${roomId}：无事发生`);
    // });
    // 一次性获取所有按钮及其文本内容
    const gifts = await frame.$$eval(SELECTORS.PRESENT_BTN, (buttons) =>
      buttons.map((button, index) => {
        return {
          index,
          text: button.querySelector('p')?.textContent.trim() || '无文本',
          count: button.querySelector('.c-count')?.textContent.trim() || '0',
        };
      })
    ).catch(err => {
      console.error(`房间 ${roomId}：获取礼物列表失败`, err);
      return [];
    });
    console.log('gifts:', gifts)
    // 4. 验证结果
    if (!gifts || gifts.length === 0) {
      console.warn(`房间 ${roomId}：礼物列表为空（选择器：${SELECTORS.PRESENT_BTN}）`);
      return [];
    }

    console.log(`房间 ${roomId}：礼物类别数：${gifts && gifts.length}`);

    // 优化改成，查找页面第一个SELECTORS.PRESENT_BTN的元素，如果文字匹配 GIFT_SUPER_TEXT 则全部赠送
    // 如果文字匹配 GIFT_FREE_TEXT 则赠送指定数量
    for (const gift of gifts) {
      const btn = await frame.$(SELECTORS.PRESENT_BTN);
      const text = await frame.evaluate(btn => btn.querySelector('p')?.textContent.trim() || '', btn);
      const realCount = await frame.evaluate(btn => btn.querySelector('.c-count')?.textContent.trim() || '0', btn);
      console.log('realGiftCount:', realCount);
      let giftCount = realCount;
      if (text === GIFT_SUPER_TEXT) {
        console.log(`房间 ${roomId}：赠送全部 ${GIFT_SUPER_TEXT}`);
      } else if (text === GIFT_FREE_TEXT) {
        giftCount = Math.min(gift.count, DEFAULT_PRESENT_NUM);
        console.log(`房间 ${roomId}：赠送免费礼物 ${GIFT_FREE_TEXT}`);
      }
      await btn.hover();
      await submitGift(roomId, frame, giftCount);
    }

    presentInit = true;
  } catch (error) {
    console.error(`房间 ${roomId}：获取礼物信息失败：`, error);
  }
}

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
  const testResults = await iframePage.$$eval('*', els =>
    els.map(el => el.tagName)
  );
  console.log('测试查询:', testResults);
}

/**
 * 执行赠送虎粮
 * @param {*} roomId 
 * @param {*} page 
 * @param {number | string} count 是否全部赠送
 */
async function submitGift(roomId, page, count) {
  console.log(`房间 ${roomId}：开始赠送礼物`);

  // 确保弹出层弹出
  await page.waitForSelector(SELECTORS.PRESENT_POPUP, { timeout: 30000 }).catch((err) => {
    console.warn(`房间 ${roomId}：ERROR  未找到礼物弹出层`);
  });
  // 选择input框输入赠送数量
  await page.click(SELECTORS.PRESENT_INPUT);
  await page.type(SELECTORS.PRESENT_INPUT, count.toString());

  await page.waitForSelector(SELECTORS.PRESENT_SUBMIT, { timeout: 10000 }).catch((err) => {
    console.warn(`房间 ${roomId}：等待赠送按钮 超时`);
  });
  // 点击赠送按钮
  console.log(`房间 ${roomId}：点击赠送按钮`);
  await page.click(SELECTORS.PRESENT_SUBMIT);
  // await page.waitForNetworkIdle({ timeout: 10000 }).catch((err) => {
  //   console.warn(`房间 ${roomId}：无事发生`);
  // });
  // 等待n秒模拟空闲
  await new Promise(resolve => setTimeout(resolve, 10000));
  // 点击立即送出
  console.log(`房间 ${roomId}：赠送成功 ${count} 个`);
}
/**
 * 找到弹出的 iframe
 * @param {*} page 
 * @returns 
 */
async function getTheIframe(page, roomId) {
  const iconBag = SELECTORS.ICON_BAG;
  await page.waitForSelector(iconBag, { timeout: 10000 }).catch((err) => {
    console.warn(`房间 ${roomId}：未找到包裹图标`);
  });
  console.log(`房间 ${roomId}：点击包裹图标`);
  page.click(SELECTORS.ICON_BAG);

  await page.waitForNetworkIdle({ timeout: 5000 }).catch((err) => {
    console.warn(`房间 ${roomId}：无事发生`);
  });
  return findFrame(page.mainFrame(), GIFT_URL_STR)
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

// function dumpFrameTree(frame, indent) {
//   console.log(indent + frame.url());
//   console.log(`Frame attrs:`, {
//     url: frame.url(),
//     name: frame.name(),
//     isDetached: frame.isDetached()
//   });
//   for (let child of frame.childFrames())
//     dumpFrameTree(child, indent + '  ');
// }