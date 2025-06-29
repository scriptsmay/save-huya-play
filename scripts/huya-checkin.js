// 本地环境变量
const puppeteer = require('puppeteer');
const {
  timeLog,
  sleep,
  getElementsByText,
  dumpAllMessage,
} = require('./util/index');
const config = require('../config/config');
const redisClient = require('../config/redis');
const huyaUserService = require('./util/huyaUserService');
const checkInService = require('./util/checkInService');
const msgService = require('./util/msgService');

const SELECTORS = config.HUYA_SELECTORS;

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 可视化模式更容易调试
    args: ['--mute-audio'], // 全局静音
    protocolTimeout: config.protocolTimeout,
  });
  try {
    const isLoggedIn = await huyaUserService.userLoginCheck(browser);
    if (!isLoggedIn) {
      timeLog('虎牙用户未登录');
      return;
    }

    // 实现了多窗口任务同时进行
    await Promise.all([
      kplCheckIn(browser),
      // 虎牙积分任务
      goH5CheckIn(browser),
      // 虎牙pc任务
      pcTaskCenter(browser),
      // 虎牙赛事预测
      matchPredict(browser),
    ]);
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();
    await sleep(5000);

    // 关闭redis,否则会卡住
    await redisClient.disconnect();

    // 启用通知服务
    await msgService.sendMessage('虎牙签到任务', dumpAllMessage()).then(() => {
      console.log('消息推送成功');
    });
  }
})();

/**
 * 打开KPL页面停留5分钟
 */
async function kplCheckIn(browser) {
  timeLog('开始执行虎牙KPL页面...');
  const page = await browser.newPage();
  try {
    await page.goto(config.URLS.URL_HUYA_LIVE_KPL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 获取当前页面的标题
    const pageTitle = await page.title();
    timeLog(`页面标题： ${pageTitle}`);

    return await sleep(5 * 60000);
  } catch (error) {
    console.error('打开虎牙KPL页面发生错误:', error);
    return false;
  }
}

/**
 * 每日任务中心签到
 * @param {*} browser
 */
async function goH5CheckIn(browser) {
  const status = await checkInService.hasCheckedIn('user', 'huya');
  // console.log(status);
  if (status.checked) {
    timeLog(`虎牙已签到，跳过执行`);
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
    await sleep(5000);
    await page.waitForSelector('.gift-list-wrap').catch((err) => {
      timeLog('任务中心：未加载面板', err.message);
    });
    // 等待并点击“签到”按钮
    await page
      .click(SELECTORS.SIGN_IN_BTN)
      .then(async () => {
        // redis记录一下
        await checkInService.setCheckIn('user', 'huya');
        await sleep(2000);
        timeLog('任务中心签到完成');
      })
      .catch((err) => {
        timeLog('未找到“签到”按钮，可能已经签过', err.message);
      });
  } catch (error) {
    console.error('打开任务中心 URL_TASK 发生错误:', error);
  } finally {
    await page.close();
  }
}

/**
 * pc任务中心白嫖积分
 * @param {*} browser
 */
async function pcTaskCenter(browser) {
  timeLog('开始执行虎牙pc任务中心任务...');
  const page = await browser.newPage();
  try {
    await page.goto(config.URLS.URL_HUYA_TASK_CENTER, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 等待任务面板加载
    await page.waitForSelector('.task-panel-wrap');
    // timeLog('任务面板已加载');
    await sleep(1000); // 等待1秒防止过快点击

    while (true) {
      let claimButtons = await getElementsByText(
        page,
        '.task-panel-wrap div',
        '领取'
      );

      if (claimButtons.length === 0) {
        break;
      }
      timeLog(`找到${claimButtons.length}个"领取"按钮，点击领取`);
      await claimButtons[0].click();
      await sleep(5000); // 添加一个延迟，防止过快点击
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(10000);

    const point = await page.$eval(
      config.HUYA_SELECTORS.HUYA_POINTS,
      (el) => el.textContent
    );
    timeLog(`虎牙任务中心 当前积分：${point}`);
  } catch (error) {
    console.error(
      `打开任务中心 ${config.URLS.URL_HUYA_TASK_CENTER} 发生错误:`,
      error.message
    );
  } finally {
    timeLog('虎牙PC任务中心任务结束，关闭页面');
    await page.close();
  }
}

/**
 * 虎牙h5 赛事预言自动领取预言币
 */
async function matchPredict(browser) {
  timeLog('开始：虎牙赛事预言...');
  const page = await browser.newPage();
  try {
    await page.goto(config.URLS.URL_HUYA_MATCH_YUYAN_POINT, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 等待任务面板加载
    await page.waitForSelector('.sign_in_info');
    // timeLog('签到面板已加载');
    await sleep(1000); // 等待1秒防止过快点击

    await page
      .locator('.sign_in_btn')
      .click()
      .then(() => {
        timeLog('虎牙赛事预言:点击签到');
      });

    await sleep(1000);

    while (true) {
      let claimButtons = await getElementsByText(
        page,
        '.task_list_ul .action_btn.on',
        '领取'
      );

      if (claimButtons.length === 0) {
        break;
      }
      timeLog(`找到${claimButtons.length}个"领取"按钮，点击领取`);
      await claimButtons[0].click();
      await sleep(5000); // 添加一个延迟，防止过快点击
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(10000);

    const point = await page.$eval(
      '.balance_detail .coin_count',
      (el) => el.textContent
    );
    timeLog(`虎牙赛事预言 预言币余额：${point}`);
  } catch (error) {
    console.error(
      `打开任务中心 ${config.URLS.URL_HUYA_TASK_CENTER} 发生错误:`,
      error.message
    );
  } finally {
    timeLog('任务结束，关闭页面');
    await page.close();
  }
}
