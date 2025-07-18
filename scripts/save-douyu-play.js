/**
 * 任务名称
 * name: 抓取斗鱼直播回放
 * 定时规则
 * cron: 1 1 * * *
 */
// const puppeteer = require('puppeteer');
const { timeLog } = require('./util/index');

// 数据库初始化
const pool = require('../config/pg');

const config = require('../config/config');
const targetUsers = config.douyu;
// const maxCount = 100;

const axios = require('axios');

async function getVideoLinks(listData) {
  const videoLinks = [];
  listData.forEach((data) => {
    data.video_list.forEach((video) => {
      videoLinks.push({
        url: `https://v.douyu.com/show/${video.hash_id}`,
        title: video.title,
        author: video.author,
        duration: video.video_str_duration || '',
        cover: video.video_pic || '',
        date: data.time || '',
        shortTitle: data.title,
      });
    });
  });

  return videoLinks;
}

/**
 * 处理列表数据
 * @param {*} url
 * @param {*} username
 * @returns
 */
async function handleList(listData, username) {
  const videos = await getVideoLinks(listData);
  timeLog(`[${username}]抓取到 ${videos.length} 条数据`);
  if (!videos.length) {
    return false;
  }

  // 批量插入数据库
  const query = `
    INSERT INTO videos (url, title, duration, cover, date, username)
    VALUES ${videos
      .map(
        (_, i) =>
          `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${
            i * 6 + 5
          }, $${i * 6 + 6})`
      )
      .join(', ')}
    ON CONFLICT (url) DO NOTHING;
  `;

  const values = videos.flatMap((v) => [
    v.url,
    v.title,
    v.duration,
    v.cover,
    v.date,
    username,
  ]);
  await pool
    .query(query, values)
    .then((res) =>
      timeLog(
        `[${username}]成功插入 ${res.rowCount} 条，跳过 ${
          videos.length - res.rowCount
        } 条重复数据`
      )
    )
    .catch((err) =>
      console.error(new Date().toLocaleString(), `[${username}]错误:`, err)
    );
}

function getDataCount(url) {
  return axios
    .get(url)
    .then((response) => {
      // 检查返回状态码
      if (response.status !== 200) {
        console.warn(`HTTP 错误! 状态码: ${response.status}`);
        return 0;
      }

      const jsonData = response.data;

      // 检查 API 返回的错误码
      if (jsonData.error !== 0) {
        console.warn(`API 错误: ${jsonData.msg}`);
        return 0;
      }

      return jsonData.data?.count || 0;
    })
    .catch((err) => {
      console.warn(`API 错误: ${err.message}`);
      return 0;
    });
}

targetUsers.forEach(async (config) => {
  const maxCount = await getDataCount(`${config.url}&page=1&limit=1`);
  timeLog(`[${config.name}]总回放数据: ${maxCount} 条`);
  const maxLimit = 20;
  const realPageCount = Math.ceil(maxCount / maxLimit);
  const pageCount = Math.min(realPageCount, config.maxPageNum);
  for (let i = 1; i <= pageCount; i++) {
    const targetUrl = `${config.url}&page=${i}&limit=${maxLimit}`;
    const respData = await axios
      .get(targetUrl)
      .then((response) => {
        const jsonData = response.data;
        // 检查 API 返回的错误码
        if (jsonData.error !== 0) {
          throw new Error(`API 错误: ${jsonData.msg}`);
        }

        // 提取视频列表
        const videoList = jsonData.data.list;

        // console.log(`获取到 ${videoList.length} 条视频数据`);
        if (videoList.length > 0) {
          console.log('第一条视频数据:', {
            show_id: videoList[0].show_id,
            title: videoList[0].title,
            time: videoList[0].time,
          });
        }

        // 可以在这里处理 videoList，比如保存到文件或数据库
        return videoList;
      })
      .catch((error) => {
        console.error('请求出错:', error.message);
      });

    await handleList(respData, config.name).catch(console.error);
  }
});
