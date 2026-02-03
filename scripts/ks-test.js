// 快手直播测试

// 定义目标 URL
const TARGET_ROOM_LIST = config.KUAISHOU_ROOM_LIST.split(',') || [];
const totalRoomCount = TARGET_ROOM_LIST.length;
const URL_PREFIX = `https://live.kuaishou.com/u/`;

const puppeteer = require('puppeteer');
const config = require('../config/config');
const { timeLog, sleep } = require('./util/index');
const KuaishouService = require('./util/kuaishouService');
const msgService = require('./util/msgService');
const redisClient = require('../config/redis');

(async () => {
  // 启动浏览器
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 使用新的Headless模式
    // 关键：排除掉 Puppeteer 指纹特征
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled', // 核心：禁用自动化控制特征
      '--no-sandbox',
      '--window-size=1920,1080',
      '--mute-audio',
    ],
    // 强制视口与窗口一致
    defaultViewport: null,
    protocolTimeout: config.protocolTimeout,
  });
  try {
    const page = await browser.newPage();

    timeLog(`快手直播测试开始,共${totalRoomCount}个直播间`);

    for (const id of TARGET_ROOM_LIST) {
      const url_test = URL_PREFIX + id;
      timeLog(`URL： ${url_test}`);

      await page.goto(url_test, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await checkRoom(page, id); // 这里会老老实实等 checkRoom 跑完再进下一个循环
      await sleep(5000);
    }
  } catch (error) {
    console.error('执行过程中出错:', error.message);
  } finally {
    // 最后打印个时间戳
    timeLog('所有任务完成，正在关闭浏览器...');
    await browser.close();
  }

  // 关闭redis,否则会卡住
  await redisClient.disconnect();
})();

async function checkRoom(page, roomId) {
  // 判断redis缓存
  const redisStatus = await KuaishouService.getStatus(roomId);
  if (redisStatus) {
    timeLog(`【${roomId}】redis中有记录，直接退出`);
    return redisStatus;
  }

  await sleep(5000);
  // 获取当前页面的标题
  const pageTitle = await page.title();
  // KSG句号-快手直播
  timeLog(`【${roomId}】标题： ${pageTitle}`);

  const authorName =
    (pageTitle.indexOf('-') > -1 && pageTitle.split('-')[0]) || '';
  if (authorName) {
    timeLog(`【${roomId}】作者： ${authorName}`);
  } else {
    timeLog(`【${roomId}】作者： 无法获取作者名称，直接退出`);
    return false;
  }

  // 查询页面上是否有 主播尚未开播 的文案
  const noLiveStatus = await page.$eval('body', (body) => {
    return body.innerText.match(/主播尚未开播/);
  });

  if (noLiveStatus) {
    timeLog(`【${roomId}】主播尚未开播，直接退出`);
    return false;
  } else {
    // service 记录一下
    await KuaishouService.setStatus(roomId, 'on');
    // 消息推送？
    await msgService.sendMessage(
      '快手直播通知',
      `【${roomId}】${authorName}直播开始！\n直播地址：${URL_PREFIX}${roomId}`
    );
  }

  await sleep(5000);
}
