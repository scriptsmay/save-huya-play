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
  PRESENT_TEXT: '虎粮',
  PRESENT_NUM: '.c-count',
  PRESENT_POPUP: '.g-present-content',
  PRESENT_INPUT: 'input[type="number"]',
  PRESENT_SUBMIT: '.c-send'
};

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
    await page.goto(URL_USER, { waitUntil: 'domcontentloaded', timeout: 30000 });

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
      const roomPage = await browser.newPage();
      for (const roomId of TARGET_ROOM_LIST) {
        await autoCheckInRoom(roomPage, roomId);
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
    await page.goto(URL_TASK, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForNetworkIdle();
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
async function autoCheckInRoom(page, roomId) {
  const URL_ROOM = `https://www.huya.com/${roomId}`;

  try {
    // 1. 导航到房间页
    console.log(`开始处理房间 ${roomId}`);
    await page.goto(URL_ROOM, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    }).catch(error => {
      console.warn(`房间 ${roomId} 网络加载超时，但一般没影响`);
      return false;
    });

    await roomCheckIn(page, roomId);
    await roomPresents(page, roomId);

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
  await page.waitForSelector(`${badgeSelector} a`, { timeout: 10000 });

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
async function roomPresents(page, roomId) {
  if (presentInit && !globalPresentNum) {
    console.log(`已经没有免费虎粮了，不再进行赠送`)
    return false;
  }
  console.log(`房间 ${roomId}：开始进行赠送普通虎粮`)
  const iconBag = SELECTORS.ICON_BAG;
  await page.waitForSelector(iconBag, { timeout: 10000 });
  console.log(`房间 ${roomId}：点击包裹图标`)
  await page.click(iconBag);

  // 点击之后会打开一个iframe，需要切换到iframe中
  // 找到那个 src 包含 payNew 的 iframe
  const iframePage = await getTheIframe(page)

  // 额外等待 iframe 内部内容加载
  await iframePage.waitForFunction(() => document.readyState === 'complete');
  // const packageList = await iframePage.waitForSelector('.g-package-list', { timeout: 10000 });

  // TODO: 未完成，这里一直找不到这个元素
  await iframePage.waitForSelector('.g-package-list', { timeout: 10000 }).catch((err) => {
    console.warn(`房间 ${roomId}：未找到任何礼物`, err);
  });

  // 如果图标的文字是"虎粮"，则进行点击
  const btns = await iframePage.$$(SELECTORS.PRESENT_BTN);
  for (const btn of btns) {
    const text = await btn.$('p').evaluate(el => el.textContent.trim());

    if (text === SELECTORS.PRESENT_TEXT) {
      console.log(`房间 ${roomId}：开始点击赠送虎粮`);
      // await btn.click();
      // 获取数量
      let totalNum = await btn.$(SELECTORS.PRESENT_NUM).evaluate(el => el.textContent.trim());
      globalPresentNum = +totalNum || 0;

      await btn.hover();
      // 确保弹出层弹出
      await iframePage.waitForSelector(SELECTORS.PRESENT_POPUP, { timeout: 3000 }).catch((err) => {
        console.warn(`房间 ${roomId}：ERROR  未找到礼物弹出层`);
      });
      // 选择input框输入赠送数量
      await iframePage.click(SELECTORS.PRESENT_INPUT);
      const num = Math.min(globalPresentNum, DEFAULT_PRESENT_NUM);
      await iframePage.type(SELECTORS.PRESENT_INPUT, num.toString());

      // 点击赠送按钮
      await iframePage.click(SELECTORS.PRESENT_SUBMIT);
      console.log(`房间 ${roomId}：赠送虎粮成功`);
      globalPresentNum -= num;
    }
  }
  presentInit = true;

}
/**
 * 找到页面中最后一个 iframe
 * @param {*} page 
 * @returns 
 */
async function getTheIframe(page) {
  const lastIframeHandle = await page.evaluateHandle(() => {
    const iframes = document.querySelectorAll('iframe');
    return iframes[iframes.length - 1];
  });

  if (!lastIframeHandle.asElement()) {
    console.warn('页面中没有 iframe');
    return null;
  }

  // 单独获取 src
  const src = await page.evaluate(iframe => iframe?.src, lastIframeHandle);
  console.log('最后一个 iframe 的 src:', src); // 在 Node.js 端打印

  const lastIframePage = await lastIframeHandle.contentFrame();
  return lastIframePage;
}
