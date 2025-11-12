// const { Cluster } = require('puppeteer-cluster');
const puppeteer = require('puppeteer');
const { timeLog, sleep } = require('./util/index');
const huyaUserService = require('./util/huyaUserService');
const config = require('../config/config');
const redisClient = require('../config/redis');

const browserOptions = {
  userDataDir: './user_data',
  headless: false,
  args: ['--mute-audio'],
  protocolTimeout: config.protocolTimeout,
};

(async () => {
  const browser = await puppeteer.launch(browserOptions);

  timeLog('Checking huya login...');
  const isLoggedIn = await huyaUserService.userLoginCheck(browser);
  if (!isLoggedIn) {
    timeLog('Huya not logged in');
  }

  await sleep(2000);

  timeLog('All tasks completed. Results:', isLoggedIn);
  await browser.close();
  await redisClient.disconnect();
})().catch((err) => {
  timeLog('error:', err);
  process.exit(1);
});
