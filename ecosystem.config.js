module.exports = {
  apps: [
    // 主应用 - Express服务器
    {
      name: 'server',
      script: './app/index.js',
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
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // 定时任务
    // 1点运行
    {
      name: 'hourly-cleanup',
      script: 'npm',
      args: 'run cleanup',
      cron_restart: '0 1 * * *',
      autorestart: false,
      watch: false,
    },
  ],
};
