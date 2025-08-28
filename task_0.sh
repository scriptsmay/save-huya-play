#!/bin/bash
# 定时任务0点运行、执行挂机脚本、执行保存虎牙直播回放地址脚本

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")" || exit 1

source "./task_common.sh"

# 创建日志目录（如果不存在）
mkdir -p logs

logfile="logs/task_0.$(date +'%Y%m%d').log"

run_node scripts/save-huya-play.js
run_node scripts/save-douyu-play.js
run_node scripts/task_0.js

echo "task_0 执行完毕"