// pages/mine/badges/badges.ts
Page({
  data: {
    badges: [
      { type: 'first_score', name: '首炮勋章', desc: '第一次得分', icon: '🔫', earned: false },
      { type: 'streak_win_3', name: '连炮勋章', desc: '连赢3局', icon: '🔥', earned: false },
      { type: 'streak_lose_3', name: '哑炮勋章', desc: '连输3局', icon: '💤', earned: false },
      { type: 'cannon_god', name: '炮神勋章', desc: '周榜第一', icon: '👑', earned: false }
    ]
  },

  onShow() {
    this.loadBadges();
  },

  async loadBadges() {
    const db = wx.cloud.database();
    try {
      const res = await db.collection('members').get();
      const earned = new Set<string>();
      (res.data as any[]).forEach(m => (m.badges || []).forEach((b: string) => earned.add(b)));

      const badges = this.data.badges.map(b => ({
        ...b,
        earned: earned.has(b.type)
      }));
      this.setData({ badges });
    } catch {}
  }
});
