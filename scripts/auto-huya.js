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
    // args: ['--window-size=1920,1080'],
    headless: false // 可视化模式更容易调试
  });
  const page = await browser.newPage();
  // await page.setViewport({
  //   width: 1920,
  //   height: 1080,
  //   deviceScaleFactor: 1,
  // });

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
      await page.waitForSelector('#qr-image', { timeout: 30000 }).catch(() => { });

      // 获取 #qr-image 的 src 属性值
      const qrImgUrl = await page.$eval('#qr-image', el => el.getAttribute('src')).catch(() => { });
      console.log('二维码图片地址:', qrImgUrl);
      console.log('请扫码登录...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 0 }).catch(() => { });
      console.log('检测到页面跳转，用户已登录');

      // 保存 cookies
      const cookies = await browser.cookies();
      fs.writeFileSync('cookies.json', JSON.stringify(cookies));
      console.log('已保存 cookies 到 cookies.json 文件');
    } else {
      // 任务中心
      // await autoTaskCheck(page);

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
    await page.goto(URL_TASK, { waitUntil: 'networkidle2', timeout: 60000 });
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
  const checkBtnPath = `//a[starts-with(@class, "Btn") and normalize-space()="打卡"]`;
  const cplBtnPath = `//a[starts-with(@class, "Btn") and normalize-space()="已完成"]`;

  try {
    // 打开房间页面
    await page.goto(URL_ROOM, { waitUntil: 'networkidle2', timeout: 60000 }).catch((err) => {
      console.warn(`打开房间 ${roomId} URL_ROOM 发生错误:`, err);
    });
    await page.evaluate(() => {
      // 滚动到页面右下角
      const container = document.querySelector('#main_col');
      if (container) {
        console.log(container)
        container.scrollLeft = container.scrollWidth;
        container.scrollTop = container.scrollHeight;
      } else {
        console.warn('#main_col 元素未找到，无法滚动');
      }
    }).catch((err) => {
      console.warn(`房间 ${roomId} 滚动失败`, err);
    });

    // 等待 badgeSelector 元素出现并点击它
    await page.waitForSelector(badgeSelector, { timeout: 0 }).catch((err) => {
      console.log(`房间 ${roomId} 查找 ${badgeSelector} 按钮 失败`, err)
    });
    // 滚动到 badgeSelector 元素
    console.log('滚动视窗...')
    await page.evaluate(() => {
      const badgeDOM = document.querySelector('#chatHostPic');
      if (badgeDOM) {
        badgeDOM.scrollIntoView({ behavior: 'smooth' });
      }
    });
    const chatHostPicElement = await page.$(badgeSelector);
    console.log(`房间 ${roomId}：点击徽章`, chatHostPicElement);
    await chatHostPicElement.click();

    // 新版查询代码
    const doneBtns = await page.$$(`#chatHostPic a[class*="Btn"]`, { timeout: 3000 }).catch((err) => {
      console.log(`房间 ${roomId} 查找已完成按钮 失败`, err)
    });
    let done = false
    if (doneBtns.length > 0) {
      doneBtns.forEach(async (btn) => {
        const text = await btn.textContent();
        if (text.includes('已完成')) {
          console.log(`房间 ${roomId}：任务已完成，跳过打卡`);
          done = true;
          return;
        }
        if (text.includes('打卡')) {
          await btn.click();
          console.log(`房间 ${roomId}：开始打卡`);
        }
      });
    }
    if (done) {
      // 跳过后续
      return;
    }

    return false;

    // // 查找已完成按钮
    // const completedButton = await page.waitForFunction(() => {
    //   return document.evaluate(cplBtnPath, chatHostPicElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    // }, { timeout: 3000 }).catch((err) => {
    //   console.log(`房间 ${roomId} 查找已完成按钮 失败`, err)
    // });
    // if (completedButton) {
    //   // 存在按钮
    //   console.log(`房间 ${roomId}：任务已完成，跳过打卡`);
    //   return;
    // }

    // // 等待按钮渲染完成 （推荐使用 waitForFunction 提高稳定性）
    // const isBtnAvailable = await page.waitForFunction(async () => {
    //   const result = document.evaluate(
    //     checkBtnPath,
    //     chatHostPicElement,
    //     null,
    //     XPathResult.FIRST_ORDERED_NODE_TYPE,
    //     null
    //   );
    //   if (result.singleNodeValue) {
    //     result.singleNodeValue.click();
    //     return true;
    //   }
    //   return false;
    // }, { timeout: 10000 }).catch((err) => {
    //   console.log(`房间 ${roomId} 等待按钮渲染完成 失败`, err)
    // });
    // if (isBtnAvailable) {
    //   console.log(`房间 ${roomId}：每日打卡福利领取成功`);
    // }


  } catch (error) {
    console.error('自动打卡过程中发生错误:', error);
  }
}
