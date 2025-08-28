#!/bin/bash
# 通用函数脚本，让其他脚本调用

# 显式设置 PATH 环境变量，确保 node 和 npm 可用
#  brew  PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
brew --version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"


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
