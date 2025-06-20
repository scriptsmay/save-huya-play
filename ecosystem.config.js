function getDelayTime(hour) {
  return hour * 60 * 60 * 1000;
}

module.exports = {
  apps: [
    // 主应用 - Express服务器
    {
      name: 'express-server',
      script: 'npm',
      args: 'start',
      watch: true, // 可选：监听文件变化自动重启
      ignore_watch: [
        // 可选：忽略监听的目录
        'node_modules',
        'user_data',
        'logs',
      ],
      env: {
        NODE_ENV: 'production',
      },
    },

    // 定时任务
    {
      name: 'kpl-everyday',
      script: './scripts/kpl-everyday.js',
      cron_restart: '0 9 * * *', // 每天9点运行
      autorestart: false, // 必须设置为false才能使用cron
      watch: false,
      // 添加以下配置避免首次执行
      restart_delay: getDelayTime(1), // 1小时延迟(毫秒)
      force: true,
    },
    {
      name: 'huya-live-badge',
      script: './scripts/huya-badgelist.js',
      cron_restart: '0 11 * * *',
      autorestart: false,
      watch: false,
      // 添加以下配置避免首次执行
      restart_delay: getDelayTime(2),
      force: true,
    },
    {
      name: 'huya-kpl-task',
      script: './scripts/huya-kpl.js',
      cron_restart: '1 0 * * *',
      autorestart: false,
      watch: false,
      // 添加以下配置避免首次执行
      restart_delay: getDelayTime(3),
      force: true,
    },
    {
      name: 'huya-live-auto',
      script: './scripts/auto-huya.js',
      cron_restart: '5 0 * * *',
      autorestart: false,
      watch: false,
      // 添加以下配置避免首次执行
      restart_delay: getDelayTime(4),
      force: true,
    },

    // 定时任务2
    // {
    //   name: 'hourly-cleanup',
    //   script: 'npm',
    //   args: 'run cleanup',
    //   cron_restart: '0 * * * *', // 每小时运行一次
    //   autorestart: false,
    //   watch: false,
    // },
  ],
};
