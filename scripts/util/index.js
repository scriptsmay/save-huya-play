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

/**
 * 当前时间戳字符串
 * @returns 格式为 YYYYMMDD_HHmmss
 */
function getTimestamp() {
  // 获取当前日期和时间并格式化为字符串
  const now = new Date();
  const timestamp =
    now.getFullYear() +
    ('0' + (now.getMonth() + 1)).slice(-2) +
    ('0' + now.getDate()).slice(-2) +
    '_' +
    ('0' + now.getHours()).slice(-2) +
    ('0' + now.getMinutes()).slice(-2) +
    ('0' + now.getSeconds()).slice(-2);
  return timestamp;
}

module.exports = {
  timeLog,
  sleep,
  getTimestamp,
};
