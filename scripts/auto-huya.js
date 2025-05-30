// 本地环境变量
require('dotenv').config();

const puppeteer = require('puppeteer');
const fs = require('fs');

// 定义目标 URL
const URL_USER = 'https://i.huya.com/';

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
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
      // 等待 #qr-image 元素出现
      console.log('正在等待二维码图片加载...60s');
      await page.waitForSelector('#qr-image', { timeout: 60000 }).catch(() => {});

      // 获取 #qr-image 的 src 属性值
      const qrImgUrl = await page.$eval('#qr-image', el => el.getAttribute('src'));
      console.log('二维码图片地址:', qrImgUrl);
      console.log('请扫码登录...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 0 });
      console.log('检测到页面跳转，用户已登录');
      
      // 保存 cookies
      const cookies = await browser.cookies();
      fs.writeFileSync('cookies.json', JSON.stringify(cookies));
      console.log('已保存 cookies 到 cookies.json 文件');
    } else {
      await autoTaskCheck(page);

      // 登录成功，开始自动打卡
      if (!process.env.ROOM_LIST) {
        console.error('请设置房间ID:  ROOM_LIST');
        return;
      }
      const ROOM_LIST = process.env.ROOM_LIST.split(',');
      for (const roomId of ROOM_LIST) {
        await autoCheckInRoom(page, roomId);
      }

    }

  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 关闭浏览器
    await browser.close();
  }
})();


async function checkLoginStatus(page) {
  // 查询 .uesr_n 元素是否存在
  const userElement = await page.$('.uesr_n');

  // 如果元素存在，说明已登录
  if (userElement) {
    const username = await page.$eval('.uesr_n', el => el.textContent.trim());
    console.log('用户已登录，用户名:', username);
    return username;
  } else {
    console.log('用户未登录');
    return false;
  }
}

/**
 * 自动签到
 * @param {*} page 
 */
async function autoTaskCheck(page) {

  const URL_TASK = 'https://hd.huya.com/h5/task_center/index.html';
  try {
    // 打开签到页面即为签到成功
    await page.goto(URL_TASK, { waitUntil: 'networkidle2', timeout: 30000 });

    // 等待 3 秒
    await page.waitForNetworkIdle();

    console.log('任务中心签到完成');
  } catch (error) {
    console.error('打开任务中心 URL_TASK 发生错误:', error);
  }
}

/**
 * 自动进入直播间，点击打卡
 * @param {Page} page 
 * @param {string} roomId 
 */
async function autoCheckInRoom(page, roomId) {
  const URL_ROOM = `https://www.huya.com/${roomId}`;
  const badgeSelector = '#chatHostPic';

  try {
    // 打开房间页面
    await page.goto(URL_ROOM, { waitUntil: 'networkidle2', timeout: 30000 });

    // 等待 badgeSelector 元素出现并点击它
    await page.waitForSelector(badgeSelector, { timeout: 10000 }).catch(() => {});
    const chatHostPicElement = await page.$(badgeSelector);
    await chatHostPicElement.click();

    // 等待按钮渲染完成（推荐使用 waitForFunction 提高稳定性）
    await page.waitForFunction(() => {
      const btn = document.evaluate(
        './/a[starts-with(@class, "Btn") and normalize-space()="打卡"]',
        chatHostPicElement,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return btn.singleNodeValue !== null;
    }, { timeout: 10000 }).catch(() => {});

    // 查找已完成按钮
    const [completedButton] = await page.$$x('.//a[starts-with(@class, "Btn") and normalize-space()="已完成"]');
    if (completedButton) {
      console.log(`房间 ${roomId}：任务已完成，跳过打卡`);
      return;
    }

    // 再次查找按钮（限定在 #chatHostPic 子元素内）
    const [checkInButton] = await page.$$x('.//a[starts-with(@class, "Btn") and normalize-space()="打卡"]');

    if (checkInButton) {
      await checkInButton.click();
      console.log(`房间 ${roomId}：每日打卡福利领取成功`);
    } else {
      console.log(`房间 ${roomId}：未找到打卡按钮`);
    }
  } catch (error) {
    console.error('自动打卡过程中发生错误:', error);
  }
}
