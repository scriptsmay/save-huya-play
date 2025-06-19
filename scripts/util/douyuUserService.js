const { timeLog } = require('./index');
// const fs = require('fs');
const config = require('../../config/config');
const cookieService = require('./cookieService');

// 常量定义
const SELECTORS = config.DOUYU_SELECTORS;

async function userLoginCheck(browser) {
  // 检查是否有保存的cookies
  // if (fs.existsSync('cookies.json')) {
  //   const cookies = JSON.parse(fs.readFileSync('cookies.json'));
  //   await browser.setCookie(...cookies);
  // }
  const loadResult = await cookieService.loadCookiesFromRedis(
    browser,
    'douyu_cookies'
  );
  if (loadResult) {
    timeLog('已从Redis中加载cookies，未过期');
    // return true;
  }

  try {
    const page = await browser.newPage();
    // 打开目标页面
    await page.goto(config.URLS.URL_DOUYU_USER, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    const username = await checkLoginStatus(page);
    if (!username) {
      timeLog('正在等待二维码图片加载...60s');
      await page
        .waitForSelector(SELECTORS.QR_IMAGE_ELEMENT, { timeout: 30000 })
        .catch((err) => {
          console.error('等待二维码元素超时:', err);
          return;
        });

      const qrImgUrl = await page
        .$eval(SELECTORS.QR_IMAGE_ELEMENT, (el) => el.getAttribute('src'))
        .catch((err) => {
          console.error('获取二维码地址失败:', err);
          return;
        });
      timeLog('二维码图片地址:', qrImgUrl);
      timeLog('请扫码登录...');
      await page
        .waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 })
        .catch((err) => {
          console.error('等待页面跳转失败:', err.message);
        });

      return await checkAndSave(page);
    } else {
      timeLog('已登录，正在保存cookies...');
      await cookieService.saveCookiesToRedis(page, 'douyu_cookies');
      return true;
    }
  } catch (error) {
    console.error('发生错误:', error);
  }
}

async function checkAndSave(page) {
  const isLoggedIn = await cookieService.checkLoginStatus(
    page,
    SELECTORS.USER_NAME_ELEMENT
  );
  if (isLoggedIn) {
    timeLog('已登录，正在保存cookies...');
    await cookieService.saveCookiesToRedis(page);
    return true;
  } else {
    timeLog('登录失败，请重新扫码登录');
    return false;
  }
}

/**
 * 异步检查登录状态
 *
 * 该函数通过检查页面上是否有特定的用户名称元素来判断用户是否已登录
 * 如果用户已登录，会打印用户名并返回用户名，否则打印用户未登录并返回false
 *
 * @param {Object} page - 一个表示当前页面的对象，用于执行页面操作
 * @returns {Promise<string | boolean>} - 返回用户名（如果已登录）或false（如果未登录）
 */
async function checkLoginStatus(page) {
  // 尝试获取页面上的用户名称元素
  const userElement = await page.$(SELECTORS.USER_NAME_ELEMENT);
  if (userElement) {
    // 获取并打印用户名称，在element的title属性上
    const username = await page.$eval(SELECTORS.USER_NAME_ELEMENT, (el) =>
      el.title.trim()
    );
    timeLog('用户已登录，用户名:', username);
    return username;
  } else {
    // 如果用户名称元素不存在，表示用户未登录
    timeLog('用户未登录');
    return false;
  }
}

// 导出 checkLoginStatus 函数
module.exports = {
  checkLoginStatus,
  userLoginCheck,
};
