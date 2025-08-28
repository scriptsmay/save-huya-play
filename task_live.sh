#!/bin/bash
# 这个是执行直播任务、打卡、送礼物的脚本

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")" || exit 1

source "./task_common.sh"

logfile="logs/task_live.$(date +'%Y%m%d').log"


start=$(date +%s)

run_node scripts/huya-kpl.js
run_node scripts/auto-huya.js
run_node scripts/douyu-live.js

end=$(date +%s)
log "执行完毕，耗时: $((end-start)) 秒"
