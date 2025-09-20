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

// 签到 按钮
const signSelector = '.Sign-module__signBtn1-iMOTD';

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

    await goTaskCenter(browser);
  } catch (error) {
    console.error('发生错误:', error.message);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();

    // 关闭redis
    await redisClient.disconnect();

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
  const page = await browser.newPage();
  const URL_TASK = config.URLS.URL_DOUYU_POINT_PAGE;
  try {
    await page.setViewport({ width: 568, height: 1024 });
    await page.goto(URL_TASK, {
      // waitUntil: 'domcontentloaded',
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await sleep(5000);
    // 检查是否已打卡
    const status = await checkInService.hasCheckedIn('user', 'douyu');
    // console.log(status);
    if (status.checked) {
      timeLog(`Redis 读取到斗鱼已签到，跳过执行`);
    } else {
      const result = await page
        .waitForSelector(signSelector, { timeout: 10000 })
        .catch((err) => {
          console.log(`未找到元素 ${signSelector}`, err.message);
        });
      if (result) {
        // timeLog('点击签到按钮');
        await page.click(signSelector);
        // redis记录一下
        await checkInService.setCheckIn('user', 'douyu');
        timeLog('等待10s自动领取积分');
        await sleep(10000);
        timeLog('任务中心签到完成');
      }
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
    await goScreenShot(page);
  }

  // await goGameTask(browser, page);
  const results = await clickTrialTasks(page);
  if (results.length > 0) {
    timeLog('斗鱼任务：等待试玩任务完成中...');
    await sleep(132000);
  }
  await sleep(5000);

  await page.close();

  // 查询当前积分
  await queryPoint(browser);
}

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

async function clickTrialTasks(page) {
  timeLog('斗鱼积分任务：开始执行`做任务领积分`游戏任务...');
  await page.waitForSelector('div[class*="Task-module__taskContent"]');

  // 直接在页面上下文中执行所有操作
  const results = await page.evaluate(async () => {
    const regex = /^试玩(?=.*2分钟)$/;
    const clickedTasks = [];

    // 获取所有任务项
    const taskItems = document.querySelectorAll(
      'div[class*="Task-module__taskItem"]'
    );

    for (const item of taskItems) {
      try {
        // 查找包含"试玩"的title
        const trialTitle = item.querySelector(
          'div[class*="taskName"]'
        )?.innerHTML;

        if (trialTitle && regex.test(trialTitle)) {
          // 查找所有div元素
          let completeBtn = item.querySelector(
            'div[class*="taskBtnUnfinished"]'
          );
          if (completeBtn) {
            completeBtn.click();
            clickedTasks.push(trialTitle);
          }
        }
      } catch (error) {
        console.log('处理任务时出错:', error.message);
      }
    }

    return clickedTasks;
  });

  if (results.length) {
    timeLog(`点击了 ${results.length} 个试玩任务:`, results);
  }

  return results;
}

async function goScreenShot(page) {
  const TARGET_FILENAME = `douyu_task.${getTimestamp()}.png`;
  const OUTPUT_FILE = `logs/screenshot/${TARGET_FILENAME}`;
  // console.log('截个图看看');
  // 设置视口大小
  await page.setViewport({ width: 568, height: 1024 });
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
