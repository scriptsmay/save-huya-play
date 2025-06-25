#!/bin/bash
# 定时任务0点运行

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")" || exit 1

# 创建日志目录（如果不存在）
mkdir -p logs

# 显式设置 PATH 环境变量，确保 node 和 npm 可用
#  brew  PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# brew --version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

logfile="logs/task_0.$(date +'%Y%m%d').log"

# 添加带时间戳的日志函数
log() {
  local timestamp="[$(date +'%Y-%m-%d %T')]"
  echo "$timestamp $*"
  echo "$timestamp $*" >>"$logfile"
}

# 封装 node 执行逻辑
run_node() {
  local script_name="$1"
  local timeout_duration="30m" # 设置超时时间为30分钟

  log "开始执行: node $script_name"
  timeout --kill-after="$timeout_duration" "$timeout_duration" node "$script_name" >>"$logfile" 2>&1
  # node "$script_name" >>"$logfile" 2>&1
  local exit_code=$?

  if [ $exit_code -eq 124 ]; then
    log "错误: node $script_name 超时，已终止"
  elif [ $exit_code -ne 0 ]; then
    log "错误: node $script_name 失败，退出码: $exit_code"
  else
    log "完成: node $script_name"
  fi
}

run_node scripts/task_0.js
