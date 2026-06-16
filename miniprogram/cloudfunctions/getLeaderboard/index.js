// cloudfunctions/getLeaderboard/index.js
// 排行榜聚合查询云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/** 根据排名生成固定颜色 */
function getAvatarColor(rank) {
  const colors = [
    '#4CAF50', '#2196F3', '#FF9800', '#E91E63',
    '#9C27B0', '#00BCD4', '#FF5722', '#607D8B'
  ];
  return colors[(rank - 1) % colors.length];
}

exports.main = async (event, context) => {
  const { dimension = 'total' } = event;

  try {
    // 获取所有已完成的比赛（含选手详情）
    const res = await db.collection('games')
      .where({ status: 'finished' })
      .field({
        cannonScores: true, players: true, playMode: true,
        name: true, playerDetails: true, matches: true
      })
      .get();

    const games = res.data;
    const memberMap = new Map();
    // 全局 ID -> {nickname, avatarUrl} 映射，从所有比赛的 playerDetails 收集
    const nameInfoMap = new Map();

    for (const game of games) {
      // 从 playerDetails 收集名字和头像
      const details = game.playerDetails || [];
      for (const p of details) {
        if (p._id && (p.nickname || p.avatarUrl)) {
          if (!nameInfoMap.has(p._id)) {
            nameInfoMap.set(p._id, {
              nickname: p.nickname || '',
              avatarUrl: p.avatarUrl || ''
            });
          }
        }
      }

      // 聚合炮分 + 统计胜负场次
      const scores = game.cannonScores || {};
      for (const [memberId, score] of Object.entries(scores)) {
        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            memberId,
            totalScore: 0,
            gamesPlayed: 0,
            wins: 0,
            maxSingleScore: 0
          });
        }
        const data = memberMap.get(memberId);
        data.totalScore += score;
        data.gamesPlayed++;
        if (score > data.maxSingleScore) {
          data.maxSingleScore = score;
        }

        // 从比赛 matches 中统计该成员本场是否获胜
        const matches = game.matches || [];
        let wonThisGame = false;
        for (const m of matches) {
          if (m.status !== 'finished') continue;
          const teamA = m.teamA || [];
          const teamB = m.teamB || [];
          const inA = teamA.includes(memberId);
          const inB = teamB.includes(memberId);
          if ((inA && m.winner === 'A') || (inB && m.winner === 'B')) {
            wonThisGame = true;
            break;
          }
        }
        if (wonThisGame) data.wins++;
      }
    }

    // 排序逻辑按维度
    let list = Array.from(memberMap.values());

    switch (dimension) {
      case 'total':
        list.sort((a, b) => b.totalScore - a.totalScore);
        list.forEach((item, i) => {
          item.rank = i + 1;
          item.score = item.totalScore;
        });
        break;
      case 'onepunch':
        list.sort((a, b) => b.maxSingleScore - a.maxSingleScore);
        list.forEach((item, i) => {
          item.rank = i + 1;
          item.score = item.maxSingleScore;
        });
        break;
      default:
        list.sort((a, b) => b.totalScore - a.totalScore);
        list.forEach((item, i) => {
          item.rank = i + 1;
          item.score = item.totalScore;
        });
    }

    // 补充昵称、头像、胜率、头像颜色
    const result = list.map(item => {
      const info = nameInfoMap.get(item.memberId) || {};
      return {
        ...item,
        nickname: info.nickname || item.memberId.slice(0, 6),
        avatarUrl: info.avatarUrl || '',
        winRate: item.gamesPlayed > 0
          ? Math.round((item.wins / item.gamesPlayed) * 100)
          : 0,
        avatarColor: getAvatarColor(item.rank)
      };
    });

    return { success: true, data: result.slice(0, 100) };
  } catch (err) {
    return { success: false, error: err.message, data: [] };
  }
};
