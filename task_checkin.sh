#!/bin/bash
# 这个是签到、任务的脚本

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")" || exit 1

source "./task_common.sh"

# 创建日志目录（如果不存在）
mkdir -p logs/screenshot

logfile="logs/task_checkin.$(date +'%Y%m%d').log"

start=$(date +%s)

# 执行任务序列
run_npm huya-checkin
sleep 5
run_npm douyu-checkin

end=$(date +%s)
log "执行完毕，耗时: $((end-start)) 秒"