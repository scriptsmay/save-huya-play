require('dotenv').config();
const puppeteer = require('puppeteer');
const { timeLog, sleep, dumpAllMessage } = require('./util/index');
const douyuUserService = require('./util/douyuUserService');
const msgService = require('./util/msgService');
const config = require('../config/config');

const collectSelector = '.LiveBox-module__wait-3DZXC';
const signSelector = '.Sign-module__signBtn1-iMOTD';

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 可视化模式更容易调试
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
        timeLog(`未找到元素 ${signSelector}`, err.message);
      });
    if (result) {
      timeLog('点击签到按钮');
      await page.click(signSelector);
      timeLog('等待10s自动领取积分');
      await sleep(10000);
      timeLog('任务中心签到完成');
    }

    const btns = await page.$$(collectSelector);
    if (btns.length > 0) {
      for (const btn of btns) {
        timeLog('点击领取按钮');
        await btn.click();
        await sleep(2000);
      }
    } else {
      timeLog('没有领取按钮');
      await page.screenshot({ path: 'logs/screenshot/douyu_task.png' });
    }

    await sleep(10000);
  } catch (error) {
    console.error(`打开任务中心 ${URL_TASK} 发生错误:`, error);
  }
  await page.close();
}
