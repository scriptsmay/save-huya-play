/**
 * 定时任务
 * 每小时清理一次日志文件和截图文件
 */

const fs = require('fs');
const path = require('path');

/**
 * 保留天数
 */
const configDays = 3;

// 日志文件，截图文件也在这个目录的子目录里
const logDir = './logs';

function deleteFiles(dir) {
  fs.readdir(dir, (err, files) => {
    if (err) {
      console.log(err);
      return;
    }
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.log(err);
          return;
        }

        // 如果是文件且已超过保留天数，则删除
        if (stats.isFile() && isOlderThanNDays(stats.mtime, configDays)) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`Failed to delete file: ${filePath}`, err);
            } else {
              console.log(`Deleted file: ${filePath}`);
            }
          });
        }
        // 如果是目录，则递归处理
        else if (stats.isDirectory()) {
          deleteFiles(filePath);
        }
      });
    });
  });
}

function isOlderThanNDays(date, days) {
  const now = new Date();
  const retentionPeriod = days * 24 * 60 * 60 * 1000; // 转换为毫秒
  return now - date > retentionPeriod;
}

// 开始执行清理任务
deleteFiles(logDir);
