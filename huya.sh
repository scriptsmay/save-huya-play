#!/bin/bash
# 执行虎牙视频回放数据的脚本

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")" || exit 1

# 创建日志目录（如果不存在）
mkdir -p logs/screenshot

# 显式设置 PATH 环境变量，确保 node 和 npm 可用
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

logfile="logs/huya-records.$(date +'%Y%m%d').log"

# 执行测试命令并记录日志
npm test >>"$logfile" 2>&1
npm run kpl >>"$logfile" 2>&1
npm run checkin >>"$logfile" 2>&1
test_exit_code=$?

if [ $test_exit_code -eq 0 ]; then
  echo "测试通过"
else
  echo "测试失败"
  exit 1
fi
