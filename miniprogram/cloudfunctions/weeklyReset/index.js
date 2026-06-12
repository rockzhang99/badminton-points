// cloudfunctions/weeklyReset/index.js
// 周榜重置定时任务 — 每周一 00:00 触发
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  // 周榜重置逻辑：
  // 在云开发中配置定时触发器，每周一触发
  // 本函数仅记录重置时间点，实际周榜在前端按 createdAt 过滤即可

  const db = cloud.database();

  // 可以在此处创建一条"周重置"记录，前端查询时过滤
  try {
    await db.collection('weekly_reset').add({
      data: {
        resetAt: new Date(),
        weekStart: getWeekStart()
      }
    });
    return { success: true, message: '周榜已重置' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}
