/**
 * 增加当前时间的日志打印
 * @param {*} msg
 */
function timeLog(...args) {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const timeStr = `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;

  console.log(timeStr, ...args);
}

/**
 * 模拟等待n毫秒
 * @param {*} ms
 * @returns
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  timeLog,
  sleep,
};
