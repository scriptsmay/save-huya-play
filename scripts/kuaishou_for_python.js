// kuaishou.js
const puppeteer = require('puppeteer');
const config = require('../config/config');
const KuaishouService = require('./util/kuaishouService');
// const msgService = require('./util/msgService');
const redisClient = require('../config/redis');
const { sleep } = require('./util/index');

const URL_PREFIX = `https://live.kuaishou.com/u/`;

(async () => {
  const roomId = process.argv[2]; // 获取 Python 传来的第一个参数
  const url = `${URL_PREFIX}${roomId}`;
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
  const page = await browser.newPage();

  try {
    await page.goto(url);
    const data = await checkRoom(page, roomId);

    // 关键：将结果转为 JSON 打印，Python 会捕获这一行
    console.log(JSON.stringify(data));
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
    await redisClient.disconnect();
  }
})();

async function checkRoom(page, roomId) {
  await sleep(5000);
  // 获取当前页面的标题
  const pageTitle = await page.title();

  const authorName =
    (pageTitle.indexOf('-') > -1 && pageTitle.split('-')[0]) || '';

  // 查询页面上是否有 主播尚未开播 的文案
  const noLiveStatus = await page.$eval('body', (body) => {
    return body.innerText.match(/主播尚未开播/);
  });

  if (noLiveStatus) {
    // nothing to do
  } else {
    // service 记录一下
    await KuaishouService.setStatus(roomId, 'on');
  }
  const result = {
    anchor_name: authorName,
    is_live: !noLiveStatus,
    flv_url: '',
  };

  try {
    // 等待 window.__INITIAL_STATE__ 变得有定义且不为 null
    await page.waitForFunction(() => window.__INITIAL_STATE__ !== undefined, {
      timeout: 5000,
    });

    const sourceData = await page.evaluate(() => window.__INITIAL_STATE__);
    if (sourceData) {
      const result = parseKuaishouData(sourceData);
      console.log(JSON.stringify(result)); // 输出给 Python 捕获
    }
  } catch (e) {
    console.error('等待数据超时:', e.message);
  }
  await sleep(5000);

  return result;
}

/**
 * 解析从 window.__INITIAL_STATE__ 或 API 获取的 sourceData
 * @param {Object} sourceData
 * @returns {Object} result
 */
function parseKuaishouData(sourceData) {
  // 初始化结果对象
  let result = {
    type: 2,
    is_live: false,
    anchor_name: '未知主播',
  };

  if (!sourceData) return result;

  // 1. 解析主播名称
  // 对应 Python: author = source_data.get('author') or source_data.get('user', {})
  const author = sourceData.author || sourceData.user || {};
  result.anchor_name = author.name || author.user_name || '未知主播';

  // 2. 获取直播流信息
  const liveStream = sourceData.liveStream;

  // 如果 liveStream 为空，处理异常或未开播
  if (!liveStream) {
    if (sourceData.errorType) {
      console.log(`访问受限或页面异常: ${sourceData.errorType}`);
    }
    return result;
  }

  // 3. 判断是否在直播
  // 对应 Python: is_living = live_stream.get('isLive') or live_stream.get('living')
  const isLiving = liveStream.isLive || liveStream.living;

  if (isLiving) {
    const playUrls = liveStream.playUrls || {};
    let reps = [];

    // 情况 A: playUrls 是字典结构 (标准网页版)
    if (typeof playUrls === 'object' && !Array.isArray(playUrls)) {
      // 使用可选链安全提取: playUrls?.h264?.adaptationSet?.representation
      reps = playUrls.h264?.adaptationSet?.representation || [];
    }

    // 情况 B: 兼容数组结构 (部分 API 返回)
    if (
      (!reps || reps.length === 0) &&
      Array.isArray(playUrls) &&
      playUrls.length > 0
    ) {
      reps = playUrls[0]?.adaptationSet?.representation || [];
    }

    // 4. 更新最终结果
    if (reps && reps.length > 0) {
      result.is_live = true;
      result.flv_url_list = reps;
    }
  }

  return result;
}
