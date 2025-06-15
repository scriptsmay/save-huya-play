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

# 添加带时间戳的日志函数
log() {
  echo "[$(date +'%Y-%m-%d %T')] $*"
}

# 封装 npm run 执行逻辑
run_npm() {
  local script_name="$1"
  log "开始执行: npm run $script_name"
  npm run "$script_name" >>"$logfile" 2>&1
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    log "错误: npm run $script_name 失败，退出码: $exit_code"
  else
    log "完成: npm run $script_name"
  fi
}

# 执行任务序列
run_npm save
sleep 5
run_npm kpl
sleep 5
run_npm huya
sleep 5
run_npm huyabadge
sleep 5
run_npm douyu

echo "执行完毕"
