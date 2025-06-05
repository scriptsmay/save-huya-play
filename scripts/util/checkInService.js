// util/checkInService.js
const redisClient = require('../../config/redis');

class CheckInService {
  async setCheckIn(userId) {
    try {
      // 计算今天24点的剩余秒数
      const now = new Date();
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // 明天
        0,
        0,
        0 // 0时0分0秒
      );
      const secondsUntilMidnight = Math.floor((todayEnd - now) / 1000);

      // 存储打卡ID，设置过期时间
      await redisClient.set(`checkin:${userId}`, '1', {
        EX: secondsUntilMidnight,
      });

      return { success: true, message: `用户 ${userId} 打卡成功` };
    } catch (err) {
      console.error('打卡失败:', err);
      return { success: false, message: '打卡失败' };
    }
  }

  async hasCheckedIn(userId) {
    try {
      const result = await redisClient.get(`checkin:${userId}`);
      return { checked: result !== null };
    } catch (err) {
      console.error('检查打卡状态失败:', err);
      return { checked: false, error: err.message };
    }
  }

  async close() {
    await redisClient.disconnect();
  }
}

module.exports = new CheckInService();
