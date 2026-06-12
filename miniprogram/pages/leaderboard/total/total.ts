// pages/leaderboard/total/total.ts
import { RankItem, RankDimension } from '../../../types/index';

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
      this.setData({ rankList: (res.result as any)?.data || [] });
    } catch {
      // 降级：客户端本地计算
      const games = wx.getStorageSync('games') || [];
      this.computeLocalRanking(dimension, games);
    }

    this.setData({ loading: false });
  },

  computeLocalRanking(dimension: string, games: any[]) {
    const memberScores: Record<string, { score: number; games: number; wins: number }> = {};

    games.forEach((game: any) => {
      const scores = game.cannonScores || {};
      Object.entries(scores).forEach(([mid, s]: [string, any]) => {
        if (!memberScores[mid]) memberScores[mid] = { score: 0, games: 0, wins: 0 };
        memberScores[mid].score += s;
        memberScores[mid].games++;
        if (s > 0) memberScores[mid].wins++;
      });
    });

    const list: RankItem[] = Object.entries(memberScores)
      .map(([mid, data]) => ({
        memberId: mid,
        nickname: mid.slice(0, 6),
        avatarUrl: '',
        score: data.score,
        rank: 0,
        gamesPlayed: data.games,
        winRate: data.games > 0 ? Math.round((data.wins / data.games) * 100) : 0
      }))
      .sort((a, b) => b.score - a.score);

    list.forEach((item, i) => { item.rank = i + 1; });
    this.setData({ rankList: list.slice(0, 50) });
  },

  onShareAppMessage() {
    return {
      title: '谁是真炮王？来星雨炮分榜一决高下！',
      path: '/pages/leaderboard/total/total'
    };
  }
});
