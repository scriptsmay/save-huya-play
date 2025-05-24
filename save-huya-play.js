/**
 * 任务名称
 * name: 抓取虎牙直播回放
 * 定时规则
 * cron: 1 1 * * *
 */
const puppeteer = require('puppeteer');
const log = require('./config/log');

// 数据库初始化
const pool = require('./config/pg')

const config = require('./config/config')
const targetUsers = config.huya
const maxPage = config.huyaPage

async function getVideoLinks(url) {
  // 1. 启动浏览器（可设置 headless: false 以查看浏览器操作）
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 2. 访问目标 URL
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // 3. 在页面中执行 DOM 查询，获取所有符合条件的 <a> 标签
    const videoLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/video/play/"]'));

      // 提取 href 和 text（可根据需求调整）
      return links.map(link => {
        const defaultTitle = link.textContent.trim()
        const title = link.querySelector('.card-title')?.textContent.trim() || ''
        return {
          url: link.href,
          title: title || defaultTitle,
          duration: link.querySelector('.cover-duration')?.textContent.trim() || '',
          cover: link.querySelector('.card-cover > img')?.src || '',
          date: link.querySelector('.detail-right')?.textContent.trim() || '',
        }
      });
    });

    return videoLinks;

  } catch (error) {
    console.error('抓取过程中出错:', error);
    return [];
  } finally {
    // 5. 关闭浏览器
    await browser.close();
  }
}

async function scrapeAndSave(url, username) {
  const videos = await getVideoLinks(url);
  log(`抓取到 ${username} 的 ${videos.length} 条数据`);
  if (!videos.length) {
    return false;
  }

  // 批量插入数据库
  const query = `
    INSERT INTO videos (url, title, duration, cover, date, username)
    VALUES ${videos.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(', ')}
    ON CONFLICT (url) DO NOTHING;
  `;

  const values = videos.flatMap(v => [v.url, v.title, v.duration, v.cover, v.date, username]);
  await pool.query(query, values)
    .then(res => log(`成功插入 ${res.rowCount} 条，跳过 ${videos.length - res.rowCount} 条重复数据`))
    .catch(err => console.error(new Date().toLocaleString(), '错误:', err));
  
}

targetUsers.forEach(async config => {
  for (let index = 0; index < maxPage; index++) {
    const targetUrl = `${config.url}&pageIndex=${index + 1}`;
    await scrapeAndSave(targetUrl, config.name).catch(console.error);
  }
  
});
