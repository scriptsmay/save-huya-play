const puppeteer = require('puppeteer');

const { sleep } = require('./util/index');

(async () => {
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 可视化模式更容易调试
    args: ['--mute-audio'], // 全局静音
  });
  const page = await browser.newPage();

  await page.goto('https://www.google.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 10000,
  });

  // Type into search box using accessible input name.
  await page.locator('aria/Search').fill('automate beyond recorder');

  // Wait and click on first result.
  await page.locator('.devsite-result-item-link').click();

  await sleep(5000);

  // Locate the full title with a unique string.
  const textSelector = await page
    .locator('text/Customize and automate')
    .waitHandle();
  const fullTitle = await textSelector?.evaluate((el) => el.textContent);

  // Print the full title.
  console.log('The title of this blog post is "%s".', fullTitle);
})();
