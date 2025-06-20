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
    },
    // 测试了一下，只有这个任务能正常运行，以下会报错
    // 还是老老实实使用crontab吧
    // {
    //   name: 'huya-live-badge',
    //   script: './scripts/huya-badgelist.js',
    //   cron_restart: '0 11 * * *',
    //   autorestart: false,
    //   watch: false,
    // },

    // 定时任务2
    {
      name: 'hourly-cleanup',
      script: 'npm',
      args: 'run cleanup',
      cron_restart: '0 * * * *', // 每小时运行一次
      autorestart: false,
      watch: false,
    },
  ],
};
