#!/bin/bash
# 截图任务脚本

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")" || exit 1
# 创建日志目录（如果不存在）
mkdir -p logs/screenshot

source "./task_common.sh"



logfile="logs/task_badge.$(date +'%Y%m%d').log"

start=$(date +%s)

run_npm badge
run_node scripts/kpl-everyday.js

end=$(date +%s)
log "执行完毕，耗时: $((end-start)) 秒"