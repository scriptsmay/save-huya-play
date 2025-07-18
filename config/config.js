require('dotenv').config();

const envs = process.env;

// 定义目标 URL
const URL_HUYA_USER = 'https://i.huya.com/';
// kpl直播 URL
const URL_HUYA_LIVE_KPL = 'https://www.huya.com/kpl';
// kpl直播任务 URL
const URL_HUYA_TASK_KPL =
  'https://zt.huya.com/14887334/mobile/index.html?iChannel=1&hideloading=1';

// 粉丝徽章页面
const URL_HUYA_BADGELIST =
  'https://i.huya.com/index.php?m=HomeIndex#/fansBadgeList';

const URL_HUYA_H5_CHECKIN = 'https://hd.huya.com/h5/task_center/index.html';

// 虎牙任务中心
const URL_HUYA_TASK_CENTER =
  'https://hd.huya.com/web/icenter-userlevel/index.html';

// 虎牙赛事预言入口 375 x 667
const URL_HUYA_MATCH_YUYAN_ENTRY =
  'https://hd.huya.com/h5/match-guess-area/index.html#/square?fromweb=1&webTTProvidedData=%7B%22lp%22%3A1571877666%2C%22roomId%22%3A660002%2C%22nick%22%3A%22%E7%8E%8B%E8%80%85%E8%8D%A3%E8%80%80%E8%B5%9B%E4%BA%8B%22%2C%22avatar%22%3A%22https%3A%2F%2Fhuyaimg.msstatic.com%2Favatar%2F1010%2F66%2F6aba6b4323ab3c52960e7bf169d08e_180_135.jpg%3F1737770255%22%7D';

const URL_HUYA_MATCH_YUYAN_POINT =
  'https://hd.huya.com/h5/match_guess_icenter/index.html?fromguesspanel=1&hideBar=1&fromweb=1';

// 常量定义
const HUYA_SELECTORS = {
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

  // 虎牙积分
  HUYA_POINTS: '.cursor-pointer .text-yellow-100',
};

// 斗鱼页面常量
// 积分页面
const URL_DOUYU_POINT_PAGE = 'https://www.douyu.com/pages/ord-task-center';
// 个人中心
const URL_DOUYU_USER = 'https://www.douyu.com/member/cp';
const DOUYU_SELECTORS = {
  USER_NAME_ELEMENT: '.uname_con',
  QR_IMAGE_ELEMENT: '.qrcode-img',
  // 去试玩
  POINT_JUMP_BTN: '.Task-module__taskBtnUnfinished-1tkzh',
  // 领取积分
  POINT_GET_BTN: '.Task-module__taskBtnWait-zpPtT',
  // 签到积分领取按钮
  SIGN_POINT_GET_BTN: '.LiveBox-module__wait-3DZXC',

  MY_POINT_NUM: '.Header-module__headerScoreNum-MCqHN',
  // // 签到按钮
  // SIGN_IN_BTN: '.task-sign',
  // // 签到成功提示
  // SIGN_IN_SUCCESS: '.task-sign-success',
};

/**
 * 斗鱼直播间配置
 */
const DOUYU_ROOMS = [
  {
    roomId: '36252',
    name: 'gemini',
  },
  {
    roomId: '10560893',
    name: '北笙',
  },
  {
    roomId: '410800',
    name: '花海',
  },
];

const qqMsgTpl = {
  group_id: 1034923436,
  message: [
    {
      type: 'text',
      data: {
        text: '{{title}}\n{{content}}\n',
      },
    },
  ],
};

const config = {
  ...envs,
  // 默认超时时间 120s
  protocolTimeout: 120000,
  siteUrl: 'http://192.168.31.10:3210/',
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
    {
      name: 'KPL小雪',
      url: 'https://www.huya.com/video/u/2374381262?tabName=live',
    },
  ],
  // 最大抓取页数，一页10条
  huyaPage: parseInt(envs.HUYA_LIVE_PAGENUM) || 2,
  URLS: {
    URL_HUYA_USER,
    URL_HUYA_LIVE_KPL,
    URL_HUYA_TASK_KPL,
    URL_HUYA_BADGELIST,
    URL_HUYA_TASK_CENTER,
    URL_HUYA_H5_CHECKIN,
    URL_HUYA_MATCH_YUYAN_ENTRY,
    URL_HUYA_MATCH_YUYAN_POINT,
    URL_DOUYU_POINT_PAGE,
    URL_DOUYU_USER,
  },
  HUYA_SELECTORS,
  DOUYU_SELECTORS,

  apiConfig: [
    {
      type: 'qq',
      url: 'http://192.168.31.10:3000/send_group_msg',
      method: 'post',
      dataTpl: JSON.stringify(qqMsgTpl),
    },
    // 可以添加更多类型的API地址
    // { type: 'wechat', url: 'http://example.com/wechat_api' }
  ],

  DOUYU_ROOMS,
};

console.log('config.NODE_ENV', config.NODE_ENV);

module.exports = config;
