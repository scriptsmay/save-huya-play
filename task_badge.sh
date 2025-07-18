#!/bin/bash
# 这个是粉丝徽章截图的脚本
# 每天执行1次就行了，每天下午15点执行比较合适

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")" || exit 1

# 创建日志目录（如果不存在）
mkdir -p logs/screenshot

# 显式设置 PATH 环境变量，确保 node 和 npm 可用
#  brew  PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
brew --version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

logfile="logs/task_huya.$(date +'%Y%m%d').log"

# 添加带时间戳的日志函数
log() {
  local timestamp="[$(date +'%Y-%m-%d %T')]"
  echo "$timestamp $*"
  echo "$timestamp $*" >>"$logfile"
}

# 封装 npm run 执行逻辑
run_npm() {
  local script_name="$1"
  local timeout_duration="30m" # 设置超时时间为30分钟

  log "开始执行: npm run $script_name"
  timeout --kill-after="$timeout_duration" "$timeout_duration" npm run "$script_name" >>"$logfile" 2>&1
  local exit_code=$?

  if [ $exit_code -eq 124 ]; then
    log "错误: npm run $script_name 超时，已终止"
  elif [ $exit_code -ne 0 ]; then
    log "错误: npm run $script_name 失败，退出码: $exit_code"
  else
    log "完成: npm run $script_name"
  fi
}

# 执行任务序列
run_npm badge

echo "执行完毕"
