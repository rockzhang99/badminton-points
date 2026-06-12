// pages/mine/index/index.ts
Page({
  data: {
    userInfo: null as any,
    stats: { totalScore: 0, totalGames: 0, cannonKingCount: 0 },
    badges: [] as string[]
  },

  onShow() {
    const app = getApp<IAppOption>();
    this.setData({ userInfo: app.globalData.userInfo });
    this.loadStats();
  },

  async loadStats() {
    const db = wx.cloud.database();
    try {
      const res = await db.collection('members').get();
      const members = res.data as any[];
      const totalScore = members.reduce((s: number, m: any) => s + (m.stats?.totalScore || 0), 0);
      const totalGames = members.reduce((s: number, m: any) => s + (m.stats?.totalGames || 0), 0);
      const kings = members.filter((m: any) => (m.stats?.cannonKingCount || 0) > 0).length;

      this.setData({
        stats: { totalScore, totalGames, cannonKingCount: kings },
        badges: members.reduce((arr: string[], m: any) => {
          (m.badges || []).forEach((b: string) => { if (!arr.includes(b)) arr.push(b); });
          return arr;
        }, [])
      });
    } catch {}
  },

  onGetUserInfo(e: any) {
    if (e.detail.userInfo) {
      const app = getApp<IAppOption>();
      app.globalData.userInfo = e.detail.userInfo;
      wx.setStorageSync('userInfo', e.detail.userInfo);
      this.setData({ userInfo: e.detail.userInfo });
    }
  },

  onGoBadges() { wx.navigateTo({ url: '/pages/mine/badges/badges' }); },
  onGoMembers() { wx.navigateTo({ url: '/pages/arsenal/members/members' }); },
  onGoHistory() { wx.switchTab({ url: '/pages/arsenal/history/history' }); },
  onGoSettings() { wx.showToast({ title: '功能开发中', icon: 'none' }); },

  onClearData() {
    wx.showModal({
      title: '炮灰粉碎',
      content: '确认清除所有本地数据？云上数据不受影响。',
      success: res => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({ title: '炮灰已粉碎！', icon: 'success' });
          this.setData({ stats: { totalScore: 0, totalGames: 0, cannonKingCount: 0 } });
        }
      }
    });
  }
});
