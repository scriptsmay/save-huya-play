// 本地环境变量
const puppeteer = require('puppeteer');
const {
  timeLog,
  sleep,
  getElementsByText,
  dumpAllMessage,
  // clickCenter,
} = require('./util/index');
const config = require('../config/config');
const redisClient = require('../config/redis');
const huyaUserService = require('./util/huyaUserService');
const checkInService = require('./util/checkInService');
const msgService = require('./util/msgService');

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

    // 虎牙赛事预测
    // config.HUYA_MATCH_PREDICT = 'false';
    await matchPredict(browser);

    timeLog('虎牙h5任务：开始执行... ', config.URLS.URL_HUYA_H5_CHECKIN);
    await goH5CheckIn(browser);
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

// async function clickTrialTasks(page) {
//   timeLog('虎牙pc任务：开始处理试玩任务...');
//   await page.waitForSelector('.task-panel-wrap ul li');

//   // 直接在页面上下文中执行所有操作
//   const results = await page.evaluate(async () => {
//     const clickedTasks = [];

//     // 获取所有任务项
//     const taskItems = document.querySelectorAll('.task-panel-wrap ul li');

//     for (const item of taskItems) {
//       try {
//         // 查找包含"试玩"的title
//         const trialTitle = item.querySelector(
//           'p[title^="试玩"][title*="2分钟"]'
//         );

//         if (trialTitle) {
//           // 查找所有div元素
//           const divs = item.querySelectorAll('div');
//           let completeBtn = null;

//           for (const div of divs) {
//             if (
//               div.textContent.trim() === '去完成' &&
//               getComputedStyle(div).cursor === 'pointer'
//             ) {
//               completeBtn = div;
//               break;
//             }
//           }

//           if (completeBtn) {
//             completeBtn.click();
//             clickedTasks.push(trialTitle.title);
//           }
//         }
//       } catch (error) {
//         console.log('处理任务时出错:', error.message);
//       }
//     }

//     return clickedTasks;
//   });

//   if (results.length) {
//     timeLog(`点击了 ${results.length} 个试玩任务:`, results);
//   }

//   return results;
// }

async function goH5CheckIn(browser) {
  const taskName = '虎牙h5任务';
  const page = await browser.newPage();
  await page.setViewport({ width: 568, height: 1024 });

  try {
    await page.goto(config.URLS.URL_HUYA_H5_CHECKIN, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 等待任务面板加载
    await page.waitForSelector('.sign-gold-wrap');
    // timeLog('任务面板已加载');
    await sleep(1000); // 等待1秒防止过快点击

    const status = await checkInService.hasCheckedIn('user', 'huya');
    if (status.checked) {
      timeLog(`虎牙h5页面已签到，跳过签到`);
    } else {
      // 签到
      const btn = await page.locator(
        '.sign-gold-wrap .box-list li .sign-btn.adm-button-primary'
      );
      if (btn) {
        await btn.click();
        // redis记录一下
        await checkInService.setCheckIn('user', 'huya');
      }
    }

    // const results = await clickTrialTasks(page, browser);
    // if (results.length > 0) {
    //   timeLog(taskName + '：等待试玩任务完成中...');
    //   await sleep(132000 * results.length);
    // }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(10000);

    let lastCount = 0;
    let nowCount = 0;
    let repeatTimes = 0;
    let maxCount = 3;
    while (true) {
      if (lastCount === nowCount) {
        repeatTimes++;
      } else {
        lastCount = nowCount;
      }

      if (repeatTimes > maxCount) {
        timeLog(`${taskName}：重复尝试领取${maxCount}次，疑似卡住，任务结束`);
        break;
      }
      // 如果有close按钮，则点击
      const btnLocator = await page
        .locator('.adm-center-popup-close.adm-plain-anchor')
        .setTimeout(3000);
      try {
        await btnLocator.wait({ timeout: 1000 });
        console.log('点击关闭弹窗');
        await btnLocator.click().catch(() => {});
        await sleep(2000);
      } catch (e) {
        console.log('元素不存在', e.message);
      }

      let claimButtons = await getElementsByText(
        page,
        '.task-center-wrap .adm-button-primary',
        '领取'
      );

      if (claimButtons.length === 0) {
        console.log('没有找到领取按钮');
        break;
      }
      nowCount = claimButtons.length;
      timeLog(`${taskName}：找到${claimButtons.length}个"领取"按钮，点击领取`);
      await claimButtons[0].click();
      await sleep(5000); // 添加一个延迟，防止过快点击
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(10000);

    // 金币真的没法通过dom查到，最好是截图看
    // .counter

    // 点击积分
    await page.click('.nav-bar-title > div:nth-child(2)');
    await sleep(3000);

    const point = await page.$eval(
      '.jifen-shop-wrap .wallet-panel-wrap .wallet-item .num-wrap .num',
      (el) => el.textContent
    );
    timeLog(`${taskName}：当前积分：${point}`);
  } catch (error) {
    console.error(
      `打开URL： ${config.URLS.URL_HUYA_H5_CHECKIN} 发生错误:`,
      error.message
    );
  } finally {
    timeLog(taskName + '：任务结束，关闭页面');
    await page.close();
  }
}

/**
 * 虎牙h5 赛事预言自动领取预言币
 */
async function matchPredict(browser) {
  if (config.HUYA_MATCH_PREDICT === 'false') {
    timeLog('虎牙赛事预言：已关闭');
    return;
  }
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
