// cloudfunctions/getLeaderboard/index.js
// 排行榜聚合查询云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { dimension = 'total' } = event;

  try {
    // 获取所有已完成的比赛
    const res = await db.collection('games')
      .where({ status: 'finished' })
      .field({ cannonScores: true, players: true, playMode: true, name: true })
      .get();

    const games = res.data;
    const memberMap = new Map();

    // 聚合炮分
    for (const game of games) {
      const scores = game.cannonScores || {};
      for (const [memberId, score] of Object.entries(scores)) {
        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            memberId,
            totalScore: 0,
            gamesPlayed: 0,
            maxSingleScore: 0
          });
        }
        const data = memberMap.get(memberId);
        data.totalScore += score;
        data.gamesPlayed++;
        if (score > data.maxSingleScore) {
          data.maxSingleScore = score;
        }
      }
    }

    // 排序逻辑按维度
    let list = Array.from(memberMap.values());

    switch (dimension) {
      case 'total':
        list.sort((a, b) => b.totalScore - a.totalScore);
        list.forEach((item, i) => { item.rank = i + 1; item.score = item.totalScore; });
        break;
      case 'onepunch':
        list.sort((a, b) => b.maxSingleScore - a.maxSingleScore);
        list.forEach((item, i) => { item.rank = i + 1; item.score = item.maxSingleScore; });
        break;
      default:
        list.sort((a, b) => b.totalScore - a.totalScore);
        list.forEach((item, i) => { item.rank = i + 1; item.score = item.totalScore; });
    }

    return { success: true, data: list.slice(0, 100) };
  } catch (err) {
    return { success: false, error: err.message, data: [] };
  }
};
