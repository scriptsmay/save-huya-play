// util/kuaishouService.js
const redisClient = require('../../config/redis');

/**
 * 快手直播状态记录服务
 */
class KuaishouService {
  async setStatus(userId, status = 'on', platform = 'kuaishou') {
    try {
      // 存储打卡ID，设置过期时间
      await redisClient.set(`liveStatus:${platform}:${userId}`, status, {
        // 10分钟过期时间
        EX: 600,
      });

      return { success: true, message: `用户 ${userId} 打卡成功` };
    } catch (err) {
      console.error('打卡失败:', err);
      return { success: false, message: '打卡失败' };
    }
  }

  async getStatus(userId, platform = 'kuaishou') {
    try {
      const result = await redisClient.get(`liveStatus:${platform}:${userId}`);
      // console.log('result', result);
      return result || false;
    } catch (err) {
      console.error('检查直播状态失败:', err);
      return false;
    }
  }

  async setRoomInfo(userId, roomInfo, platform = 'kuaishou') {
    try {
      // 存储直播间信息，设置过期时间
      await redisClient.set(
        `liveRoomInfo:${platform}:${userId}`,
        JSON.stringify(roomInfo),
        {
          // 10分钟过期时间
          EX: 600,
        }
      );

      return { success: true, message: `用户 ${userId} 打卡成功` };
    } catch (err) {
      console.error('打卡失败:', err);
    }
  }

  async getRoomInfo(userId, platform = 'kuaishou') {
    try {
      const result = await redisClient.get(
        `liveRoomInfo:${platform}:${userId}`
      );
      // console.log('result', result);
      return JSON.parse(result) || false;
    } catch (e) {
      console.error('检查直播状态失败:', e);
      return false;
    }
  }
}

module.exports = new KuaishouService();
