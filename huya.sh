#!/bin/bash
# 执行虎牙视频回放数据的脚本

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")"

# 显式设置 PATH 环境变量，确保 node 和 npm 可用
source /Users/virola/.nvm/nvm.sh

# 执行 npm test 命令
npm test >> "logs/huya-records.$(date +'%Y%m%d').log" 2>&1

if [ $? -eq 0 ]; then
  echo "测试通过"
else
  echo "测试失败"
  exit 1
fi
