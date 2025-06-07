// 定义目标 URL
const URL_HUYA_USER = 'https://i.huya.com/';
// kpl直播 URL
const URL_HUYA_LIVE_KPL = 'https://www.huya.com/kpl';
// kpl直播任务 URL
const URL_HUYA_TASK_KPL =
  'https://zt.huya.com/14887334/mobile/index.html?iChannel=1&hideloading=1';

// 常量定义
const SELECTORS = {
  USER_NAME_ELEMENT: '.uesr_n',
  QR_IMAGE_ELEMENT: '#qr-image',
  // 任务中心
  SIGN_IN_BTN: '.sign-btn',
  // 礼物包裹
  BADGE_SELECTOR: '#chatHostPic',
  CHECK_BTN_TEXT: '打卡',
  CPL_BTN_TEXT: '已完成',
  // 礼物包裹图标
  ICON_BAG: '#player-package-btn',
  PRESENT_BTN: '.m-gift-item',
  PRESENT_POPUP: '.g-present-content',
  PRESENT_INPUT: 'input[type="number"]',
  PRESENT_SUBMIT: '.c-send',
};

const config = {
  huya: [
    {
      name: 'KPL钟意',
      url: 'https://www.huya.com/video/u/1199623075521?tabName=live',
    },
    {
      name: 'KPL长生',
      url: 'https://www.huya.com/video/u/1686581670?tabName=live',
    },
    {
      name: 'KPL归期',
      url: 'https://www.huya.com/video/u/1692032870?tabName=live',
    },
  ],
  // 最大抓取页数，一页10条
  huyaPage: 2,
  URLS: { URL_HUYA_USER, URL_HUYA_LIVE_KPL, URL_HUYA_TASK_KPL },
  HUYA_SELECTORS: SELECTORS,
};

module.exports = config;
