require('dotenv').config();
const puppeteer = require('puppeteer');
const { timeLog, sleep, dumpAllMessage } = require('./util/index');
const douyuUserService = require('./util/douyuUserService');
const msgService = require('./util/msgService');
const checkInService = require('./util/checkInService');
const config = require('../config/config');

// 签到 按钮
const signSelector = '.Sign-module__signBtn1-iMOTD';

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 可视化模式更容易调试
    args: ['--mute-audio'], // 全局静音
  });

  try {
    await douyuUserService.userLoginCheck(browser);

    await sleep(5000);

    await goTaskCenter(browser);
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();

    // 关闭redis
    await checkInService.close();

    // 启用通知服务
    await msgService.sendMessage('斗鱼打卡任务', dumpAllMessage()).then(() => {
      console.log('消息推送成功');
    });
  }
})();

/**
 * 每日任务中心签到任务
 * @param {*} browser
 */
async function goTaskCenter(browser) {
  if (process.env.DOUYU_NOCHECKIN == '1') {
    // 跳过签到
    return false;
  }
  // 检查是否已打卡
  const status = await checkInService.hasCheckedIn('user', 'douyu');
  // console.log(status);
  if (status.checked) {
    timeLog(`Redis 读取到斗鱼已签到，跳过执行`);
    await sleep(3000);
    return;
  }
  const page = await browser.newPage();
  const URL_TASK = config.URLS.URL_DOUYU_POINT_PAGE;
  try {
    await page.goto(URL_TASK, {
      // waitUntil: 'domcontentloaded',
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await sleep(5000);

    const result = await page
      .waitForSelector(signSelector, { timeout: 10000 })
      .catch((err) => {
        console.log(`未找到元素 ${signSelector}`, err.message);
      });
    if (result) {
      timeLog('点击签到按钮');
      await page.click(signSelector);
      // redis记录一下
      await checkInService.setCheckIn('user', 'douyu');
      timeLog('等待10s自动领取积分');
      await sleep(10000);
      timeLog('任务中心签到完成');
    }

    // 签到积分
    const btns = await page.$$(config.DOUYU_SELECTORS.SIGN_POINT_GET_BTN);
    if (btns.length > 0) {
      for (const btn of btns) {
        timeLog('点击领取按钮');
        await btn.click();
        await sleep(2000);
      }
    }

    await sleep(10000);
  } catch (error) {
    console.error(`打开任务中心 ${URL_TASK} 发生错误:`, error);
  }

  console.log('截个图看看');
  await page.screenshot({ path: 'logs/screenshot/douyu_task.png' });

  await goGameTask(browser, page);

  await sleep(5000);
  await page.close();

  // 查询当前积分
  await queryPoint(browser);
}

async function goGameTask(browser, page) {
  const tasks = await page.$$(config.DOUYU_SELECTORS.POINT_JUMP_BTN);
  if (tasks.length > 0) {
    for (const task of tasks) {
      timeLog('点击`去试玩`按钮');
      await task.click();
      await sleep(5000);
      // 等待新页面加载
      // 获取所有页面
      const pages = await browser.pages();
      const newPage = pages[pages.length - 1];
      // 获取页面标题并打印
      const title = await newPage.title();
      timeLog(`页面标题： ${title}`);
      timeLog('等待132s...');
      // 试玩2分钟
      await sleep(132000);

      await newPage.close();
      await sleep(5000);
    }
    await page.reload();
  }

  while (true) {
    const btn = await page.$(config.DOUYU_SELECTORS.POINT_GET_BTN);
    if (!btn) {
      timeLog('没有可领取的按钮了');
      break;
    }
    timeLog('点击`做任务领积分`按钮');
    await btn.click();
    await sleep(3000);

    timeLog('刷新页面，等待5s...');
    await page.reload();
    await sleep(5000);
  }
}

// async function getPointBtns(page) {
//   const getBtn = await page.$(config.DOUYU_SELECTORS.POINT_GET_BTN);
//   return getBtn;
// }

async function queryPoint(browser) {
  const page = await browser.newPage();
  const URL_TASK = config.URLS.URL_DOUYU_POINT_PAGE;
  try {
    await page.goto(URL_TASK, {
      // waitUntil: 'domcontentloaded',
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await sleep(5000);

    const point = await page.$eval(
      config.DOUYU_SELECTORS.MY_POINT_NUM,
      (el) => el.textContent
    );
    timeLog(`当前积分：${point}`);
  } catch (error) {
    console.error(`打开任务中心 ${URL_TASK} 发生错误:`, error);
  } finally {
    await page.close();
  }
}
