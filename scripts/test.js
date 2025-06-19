const puppeteer = require('puppeteer');

const { sleep, getElementsByText } = require('./util/index');

(async () => {
  const browser = await puppeteer.launch({
    userDataDir: './user_data', // 指定用户数据目录
    headless: false, // 可视化模式更容易调试
    args: ['--mute-audio'], // 全局静音
  });
  const page = await browser.newPage();

  // // Type into search box using accessible input name.
  // await page.locator('aria/Search').fill('automate beyond recorder');

  // // Wait and click on first result.
  // await page.locator('.devsite-result-item-link').click();

  // // Locate the full title with a unique string.
  // const textSelector = await page
  //   .locator('text/Customize and automate')
  //   .waitHandle();
  // const fullTitle = await textSelector?.evaluate((el) => el.textContent);

  // // Print the full title.
  // console.log('The title of this blog post is "%s".', fullTitle);

  // 导航到目标页面
  await page.goto('https://hd.huya.com/web/icenter-userlevel/index.html');

  // 等待任务面板加载
  await page.waitForSelector('.task-panel-wrap');
  console.log('任务面板已加载');

  await sleep(1000); // 等待1秒防止过快点击

  while (true) {
    let claimButtons = await getElementsByText(
      page,
      '.task-panel-wrap div',
      '领取'
    );
    if (claimButtons.length === 0) {
      break;
    }
    console.log(`找到${claimButtons.length}个"领取"按钮`);
    await claimButtons[0].click();
    await sleep(3000); // 添加一个延迟，防止过快点击
  }

  await page.close();

  await browser.close();
})();
