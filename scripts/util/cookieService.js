const redisClient = require('../../config/redis');

// 存储 Cookie 到 Redis
async function saveCookiesToRedis(page, key = 'browser_cookies') {
  const cookies = await page.cookies();

  // 转换过期时间为 Unix 时间戳（如果存在）
  const cookiesWithTimestamp = cookies.map((cookie) => {
    if (cookie.expires) {
      // 将过期时间从秒转换为毫秒（Puppeteer 返回的是秒）
      cookie.expires = cookie.expires * 1000;
    }
    return cookie;
  });

  // 存储到 Redis，设置过期时间为最远的 Cookie 过期时间
  await redisClient.set(key, JSON.stringify(cookiesWithTimestamp));

  // console.log('Cookies saved to Redis');
}

/**
 * 从 Redis 加载 Cookie
 * @param {*} page
 * @param {*} key
 * @returns {Boolean} 成功or失败
 */
async function loadCookiesFromRedis(target, key = 'browser_cookies') {
  const cookiesString = await redisClient.get(key);

  if (!cookiesString) {
    console.log('No cookies found in Redis');
    return false;
  }

  const cookies = JSON.parse(cookiesString);

  // 检查是否有已过期的 Cookie
  const now = Date.now();
  const validCookies = cookies.filter((cookie) => {
    if (!cookie.expires) return true; // 会话 Cookie，没有过期时间
    return cookie.expires > now;
  });

  if (validCookies.length === 0) {
    console.log('All cookies in Redis have expired');
    return false;
  }

  // 设置有效的 Cookie
  await target.setCookie(...validCookies);
  return true;
}

/**
 * 通过 selector 检查登录状态
 * @param {*} page
 * @param {*} checkSelector
 * @returns
 */
async function checkLoginStatus(page, checkSelector = '.user_name') {
  try {
    await page.waitForSelector(checkSelector, { timeout: 5000 });
    return true;
  } catch (e) {
    console.log('Not logged in', e.message);
    return false;
  }
}

module.exports = { saveCookiesToRedis, loadCookiesFromRedis, checkLoginStatus };
