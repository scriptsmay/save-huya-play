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

  console.log('Cookies saved to Redis');
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

// // 主函数
// async function main() {
//   const browser = await puppeteer.launch({
//     headless: false, // 设置为 true 以无头模式运行
//     args: ['--no-sandbox', '--disable-setuid-sandbox'],
//   });

//   const page = await browser.newPage();

//   // 尝试从 Redis 加载 Cookie
//   const hasValidCookies = await loadCookiesFromRedis(page);

//   // 导航到目标网站
//   await page.goto('https://example.com/login'); // 替换为目标网站

//   // 检查登录状态
//   const isLoggedIn = await checkLoginStatus(page);

//   if (!isLoggedIn) {
//     console.log('Not logged in, performing login...');

//     // 执行登录操作（根据你的网站修改）
//     await page.type('#username', 'your_username');
//     await page.type('#password', 'your_password');
//     await page.click('#login-button');

//     // 等待登录完成
//     await page.waitForNavigation();

//     // 保存新的 Cookie 到 Redis
//     await saveCookiesToRedis(page);
//   } else {
//     console.log('Already logged in using cookies from Redis');
//   }

//   // 在这里继续你的其他操作...

//   // 关闭浏览器时再次保存 Cookie（可选）
//   browser.on('disconnected', async () => {
//     await saveCookiesToRedis(page);
//     await redisClient.disconnect();
//   });
// }

module.exports = { saveCookiesToRedis, loadCookiesFromRedis, checkLoginStatus };
