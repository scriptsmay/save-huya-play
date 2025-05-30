// 本地环境变量
require('dotenv').config();

const puppeter = require('puppeteer');
const fs = require('fs');

// 定义目标 URL
const URL_USER = 'https://i.huya.com/';

// 常量定义
const SELECTORS = {
  USER_NAME_ELEMENT: '.uesr_n',
  QR_IMAGE_ELEMENT: '#qr-image',
  BADGE_SELECTOR: '#chatHostPic',
  CHECK_BTN_TEXT: '打卡',
  CPL_BTN_TEXT: '已完成'
};

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
    await page.goto(URL_USER, { waitUntil: 'networkidle2', timeout: 30000 });

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
      autoTaskCheck(page);

      if (!process.env.ROOM_LIST) {
        console.error('请设置房间ID: ROOM_LIST');
        return;
      }
      const roomPage = await browser.newPage();
      const ROOM_LIST = process.env.ROOM_LIST.split(',');
      for (const roomId of ROOM_LIST) {
        await autoCheckInRoom(roomPage, roomId);
      }
    }

  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    await browser.close();
  }
})();

async function checkLoginStatus(page) {
  const userElement = await page.$(SELECTORS.USER_NAME_ELEMENT);
  if (userElement) {
    const username = await page.$eval(SELECTORS.USER_NAME_ELEMENT, el => el.textContent.trim());
    console.log('用户已登录，用户名:', username);
    return username;
  } else {
    console.log('用户未登录');
    return false;
  }
}

async function autoTaskCheck(page) {
  const URL_TASK = 'https://hd.huya.com/h5/task_center/index.html';
  try {
    await page.goto(URL_TASK, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForNetworkIdle();
    console.log('任务中心签到完成');
  } catch (error) {
    console.error('打开任务中心 URL_TASK 发生错误:', error);
  }
}

async function autoCheckInRoom(page, roomId) {
  const URL_ROOM = `https://www.huya.com/${roomId}`;
  const badgeSelector = SELECTORS.BADGE_SELECTOR;

  try {
    // 1. 导航到房间页
    console.log(`开始处理房间 ${roomId}`);
    await page.goto(URL_ROOM, {
      waitUntil: 'networkidle2',
      timeout: 15000
    }).catch(error => {
      console.warn(`房间 ${roomId} 加载超时:`);
    });

    // 2. 等待并滚动到徽章元素
    await page.waitForSelector(badgeSelector, { timeout: 10000 });
    await page.evaluate((selector, rid) => {
      const badgeDOM = document.querySelector(selector);
      if (badgeDOM) {
        badgeDOM.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        console.log(`房间 ${rid}：滚动到徽章元素`);
      }
    }, badgeSelector, roomId);

    // 3. hover徽章

    await page.hover(badgeSelector);
    console.log(`房间 ${roomId}：点击徽章`);

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

  } catch (error) {
    console.error(`房间 ${roomId} 自动打卡过程中发生错误:`, error);
  }
}