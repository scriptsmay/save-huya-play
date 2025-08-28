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

const H5_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

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
  timeLog('【虎牙KPL】打开页面停留5分钟...');
  const page = await browser.newPage();
  try {
    await page.goto(config.URLS.URL_HUYA_LIVE_KPL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 获取当前页面的标题
    const pageTitle = await page.title();
    timeLog(`【虎牙KPL】页面标题： ${pageTitle}`);

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
  const page = await browser.newPage();
  // const URL_TASK = config.URLS.URL_HUYA_H5_CHECKIN;
  // 设置成移动页面的UA和尺寸
  await page.setUserAgent(H5_USER_AGENT);
  await page.setViewport({ width: 375, height: 824 });
  try {
    await page.goto(config.URLS.URL_HUYA_H5_CHECKIN, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await sleep(5000);
    await page.waitForSelector('.gift-list-wrap').catch((err) => {
      timeLog('h5任务中心：未加载面板', err.message);
    });

    await checkH5CheckIn(page);

    await checkH5Btns(page);
  } catch (error) {
    console.error(
      `打开任务中心 ${config.URLS.URL_HUYA_H5_CHECKIN} 发生错误:`,
      error
    );
  } finally {
    await page.close();
  }
}

// 检查元素是否存在并可见
const checkDOM = async (page, selector) => {
  const element = await page.locator(selector);

  if ((await element.count()) > 0 && (await element.isVisible())) {
    // console.log('元素存在且可见，正在点击...');
    // await element.click();
    return true;
  } else {
    // console.log('元素不存在或不可见');
    return false;
  }
};

/**
 * 每日h5签到检查
 * @param {*} page
 * @returns
 */
async function checkH5CheckIn(page) {
  const status = await checkInService.hasCheckedIn('h5user', 'huya');
  if (status.checked) {
    timeLog(`虎牙h5任务中心：已签到，跳过执行`);
    // 跳过签到
    return false;
  }
  // 判断今天是否领过了
  const sBtn = await checkDOM(page, SELECTORS.SIGN_IN_BTN);
  if (!sBtn) {
    const headerText = await page.$eval(
      '.header-tit',
      (element) => element.innerText
    );
    timeLog('虎牙h5任务中心：今日已签到；', headerText);
    await checkInService.setCheckIn('h5user', 'huya');
    // 跳过签到
    return false;
  }
  // 等待并点击“签到”按钮
  await page
    .click(SELECTORS.SIGN_IN_BTN)
    .then(async () => {
      // 弹出了安全验证
      const checkResult = await checkDOM(page, '.dialog-safe');
      console.log(checkResult);
      if (!checkResult) {
        // redis记录一下
        await checkInService.setCheckIn('h5user', 'huya');
        await sleep(2000);
        timeLog('h5任务中心：签到完成');
      } else {
        timeLog(
          'h5任务中心：签到失败，出现安全验证需要手动执行！！ 请访问： ',
          config.URLS.URL_HUYA_H5_CHECKIN
        );
      }
    })
    .catch((err) => {
      timeLog('h5任务中心：未找到“签到”按钮，可能已经签过', err.message);
    });
}

/**
 * h5页面日常金币任务
 * @param {*} page
 */
async function checkH5Btns(page) {
  let claimButtons = await getElementsByText(
    page,
    '.task-wrap-gold .adm-button-primary span',
    '领取'
  );

  if (claimButtons.length) {
    timeLog(
      `虎牙h5日常任务：金币页面，找到${claimButtons.length}个"领取"按钮，请访问： ${config.URLS.URL_HUYA_H5_CHECKIN}`
    );
  }
  // for (const btn of claimButtons) {
  //   await btn.click();
  //   await sleep(5000);
  // }
}

/**
 * pc任务中心白嫖积分
 * @param {*} browser
 */
async function pcTaskCenter(browser) {
  timeLog('虎牙pc任务：开始执行... ', config.URLS.URL_HUYA_TASK_CENTER);
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

    const results = await clickTrialTasks(page, browser);
    if (results.length > 0) {
      timeLog('虎牙pc任务：等待试玩任务完成中...');
      await sleep(132000 * results.length);
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(10000);

    while (true) {
      let claimButtons = await getElementsByText(
        page,
        '.task-panel-wrap div',
        '领取'
      );

      if (claimButtons.length === 0) {
        console.log('没有找到领取按钮');
        break;
      }
      timeLog(`虎牙pc任务：找到${claimButtons.length}个"领取"按钮，点击领取`);
      await claimButtons[0].click();
      await sleep(5000); // 添加一个延迟，防止过快点击
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(10000);

    const point = await page.$eval(
      config.HUYA_SELECTORS.HUYA_POINTS,
      (el) => el.textContent
    );
    timeLog(`虎牙pc任务：当前积分：${point}`);
  } catch (error) {
    console.error(
      `打开任务中心 ${config.URLS.URL_HUYA_TASK_CENTER} 发生错误:`,
      error.message
    );
  } finally {
    timeLog('虎牙pc任务：任务结束，关闭页面');
    await page.close();
  }
}

async function clickTrialTasks(page) {
  timeLog('虎牙pc任务：开始处理试玩任务...');
  await page.waitForSelector('.task-panel-wrap ul li');

  // 直接在页面上下文中执行所有操作
  const results = await page.evaluate(async () => {
    const clickedTasks = [];

    // 获取所有任务项
    const taskItems = document.querySelectorAll('.task-panel-wrap ul li');

    for (const item of taskItems) {
      try {
        // 查找包含"试玩"的title
        const trialTitle = item.querySelector('p[title^="试玩"]');

        if (trialTitle) {
          // 查找所有div元素
          const divs = item.querySelectorAll('div');
          let completeBtn = null;

          for (const div of divs) {
            if (
              div.textContent.trim() === '去完成' &&
              getComputedStyle(div).cursor === 'pointer'
            ) {
              completeBtn = div;
              break;
            }
          }

          if (completeBtn) {
            completeBtn.click();
            clickedTasks.push(trialTitle.title);
          }
        }
      } catch (error) {
        console.log('处理任务时出错:', error.message);
      }
    }

    return clickedTasks;
  });

  timeLog(`点击了 ${results.length} 个试玩任务:`, results);

  return results;
}

/**
 * 虎牙h5 赛事预言自动领取预言币
 */
async function matchPredict(browser) {
  timeLog('虎牙赛事预言：开始执行...');
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
        timeLog('虎牙赛事预言：已点击签到');
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
      timeLog(`虎牙赛事预言：找到${claimButtons.length}个"领取"按钮，点击领取`);
      await claimButtons[0].click();
      await sleep(5000); // 添加一个延迟，防止过快点击
    }

    // const classBtn = '.recevie_btn';
    while (true) {
      const buttons = await page.$$('.recevie_btn:not(.disable)');
      if (buttons.length === 0) {
        break;
      }
      timeLog(`虎牙赛事预言2：找到${buttons.length}个"领取"按钮，点击领取`);
      await buttons[0].click();
      await sleep(3000); // 添加一个延迟，防止过快点击
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(10000);

    const point = await page.$eval(
      '.balance_detail .coin_count',
      (el) => el.textContent
    );
    timeLog(`虎牙赛事预言：预言币余额：${point}`);
  } catch (error) {
    console.error(
      `虎牙赛事预言：打开任务中心 ${config.URLS.URL_HUYA_MATCH_YUYAN_POINT} 发生错误:`,
      error.message
    );
  } finally {
    timeLog('虎牙赛事预言：任务结束，关闭页面');
    await page.close();
  }
}
