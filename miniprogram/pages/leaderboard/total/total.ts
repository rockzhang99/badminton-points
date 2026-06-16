// pages/leaderboard/total/total.ts
import { RankItem, RankDimension } from '../../../types/index';

/** 根据排名生成固定颜色 */
const AVATAR_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#E91E63',
  '#9C27B0', '#00BCD4', '#FF5722', '#607D8B'
];

function getAvatarColor(rank: number): string {
  return AVATAR_COLORS[(rank - 1) % AVATAR_COLORS.length];
}

Page({
  data: {
    activeTab: 'total' as RankDimension,
    tabs: [
      { key: 'total', label: '总炮分榜' },
      { key: 'weekly', label: '周炮王榜' },
      { key: 'onepunch', label: '一炮入魂' },
      { key: 'anti', label: '抗炮榜' }
    ] as { key: string; label: string }[],

    rankList: [] as RankItem[],
    loading: false
  },

  onShow() {
    this.loadRanking(this.data.activeTab);
  },

  switchTab(e: any) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeTab: key });
    this.loadRanking(key);
  },

  async loadRanking(dimension: string) {
    this.setData({ loading: true });

    try {
      // 尝试调用云函数
      const res = await wx.cloud.callFunction({
        name: 'getLeaderboard',
        data: { dimension }
      });
      const list = ((res.result as any)?.data || []).map((item: any) => ({
        ...item,
        avatarColor: item.avatarColor || getAvatarColor(item.rank || 1)
      }));
      this.setData({ rankList: list });
    } catch {
      // 降级：客户端本地计算
      const games = wx.getStorageSync('games') || [];
      this.computeLocalRanking(dimension, games);
    }

    this.setData({ loading: false });
  },

  computeLocalRanking(dimension: string, games: any[]) {
    const memberScores: Record<string, { score: number; games: number; wins: number }> = {};

    // 先从所有比赛收集 ID -> 昵称 映射
    const nameInfoMap = new Map<string, { nickname: string; avatarUrl: string }>();

    games.forEach((game: any) => {
      const details = game.playerDetails || [];
      for (const p of details) {
        if (p._id && !nameInfoMap.has(p._id)) {
          nameInfoMap.set(p._id, {
            nickname: p.nickname || '',
            avatarUrl: p.avatarUrl || ''
          });
        }
      }
    });

    games.forEach((game: any) => {
      const scores = game.cannonScores || {};
      Object.entries(scores).forEach(([mid, s]: [string, any]) => {
        if (!memberScores[mid]) memberScores[mid] = { score: 0, games: 0, wins: 0 };
        memberScores[mid].score += s;
        memberScores[mid].games++;

        // 从 matches 中判断本场是否获胜
        const matches = game.matches || [];
        let wonThisGame = false;
        for (const m of matches) {
          if (m.status !== 'finished') continue;
          const teamA = m.teamA || [];
          const teamB = m.teamB || [];
          if ((teamA.includes(mid) && m.winner === 'A') ||
              (teamB.includes(mid) && m.winner === 'B')) {
            wonThisGame = true;
            break;
          }
        }
        if (wonThisGame) memberScores[mid].wins++;
      });
    });

    const list: RankItem[] = Object.entries(memberScores)
      .map(([mid, data], idx) => {
        const info = nameInfoMap.get(mid) || {};
        return {
          memberId: mid,
          nickname: info.nickname || mid.slice(0, 6),
          avatarUrl: info.avatarUrl || '',
          score: data.score,
          rank: 0,
          gamesPlayed: data.games,
          winRate: data.games > 0 ? Math.round((data.wins / data.games) * 100) : 0,
          avatarColor: getAvatarColor(idx + 1)
        } as any;
      })
      .sort((a, b) => b.score - a.score);

    list.forEach((item, i) => {
      item.rank = i + 1;
      item.avatarColor = getAvatarColor(i + 1);
    });

    this.setData({ rankList: list.slice(0, 50) });
  },

  onShareAppMessage() {
    return {
      title: '谁是真炮王？来星羽炮分榜一决高下！',
      path: '/pages/leaderboard/total/total'
    };
  }
});
