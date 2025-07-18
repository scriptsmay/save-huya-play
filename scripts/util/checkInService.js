// util/checkInService.js
const redisClient = require('../../config/redis');
const { getSecondsUntilMidnight } = require('./index');

class CheckInService {
  async setCheckIn(userId, platform = 'huya') {
    try {
      // 存储打卡ID，设置过期时间
      await redisClient.set(`checkin:${platform}:${userId}`, '1', {
        EX: getSecondsUntilMidnight(),
      });

      return { success: true, message: `用户 ${userId} 打卡成功` };
    } catch (err) {
      console.error('打卡失败:', err);
      return { success: false, message: '打卡失败' };
    }
  }

  async hasCheckedIn(userId, platform = 'huya') {
    try {
      const result = await redisClient.get(`checkin:${platform}:${userId}`);
      return { checked: result !== null };
    } catch (err) {
      console.error('检查打卡状态失败:', err);
      return { checked: false, error: err.message };
    }
  }

  /**
   * 已送礼
   * @param {*} userId
   * @returns
   */
  async setGift(userId) {
    try {
      // 存储打卡ID，设置过期时间
      await redisClient.set(`gift:${userId}`, '1', {
        EX: getSecondsUntilMidnight(),
      });

      return { success: true, message: `用户 ${userId} 送礼物成功` };
    } catch (err) {
      console.error('送礼物失败:', err);
      return { success: false, message: '送礼物失败' };
    }
  }

  async hasGift(userId) {
    try {
      const result = await redisClient.get(`gift:${userId}`);
      return { checked: result !== null };
    } catch (err) {
      console.error('检查礼物状态失败:', err);
      return { checked: false, error: err.message };
    }
  }
}

module.exports = new CheckInService();
