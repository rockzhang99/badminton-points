// pages/index/index.ts
import { PlayModeConfig } from '../../types/index';
import { PLAY_MODES } from '../../utils/play-modes';

Page({
  data: {
    playModes: PLAY_MODES,
    recentGames: [] as any[],
    showEmpty: true,
    cannonSlogan: '一炮组局，炮分上榜'
  },

  onShow() {
    this.loadRecentGames();
  },

  loadRecentGames() {
    const db = wx.cloud.database();
    db.collection('games')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get()
      .then(res => {
        this.setData({
          recentGames: res.data,
          showEmpty: res.data.length === 0
        });
      })
      .catch(() => {
        // 离线模式：从缓存读
        const cached = wx.getStorageSync('recentGames') || [];
        this.setData({
          recentGames: cached,
          showEmpty: cached.length === 0
        });
      });
  },

  /** 选择玩法，跳转建局页 */
  onSelectMode(e: any) {
    const mode: PlayModeConfig = e.currentTarget.dataset.mode;
    wx.navigateTo({
      url: `/pages/cannon/create/create?mode=${mode.mode}`
    });
  },

  /** 一键重新开炮 */
  onReplay(e: any) {
    const gameId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/cannon/create/create?replay=${gameId}`
    });
  },

  /** 进入历史比赛 */
  onViewHistory() {
    wx.switchTab({ url: '/pages/arsenal/history/history' });
  },

  /** 分享 */
  onShareAppMessage() {
    return {
      title: '星雨炮分榜 - 一炮组局，炮分上榜',
      path: '/pages/index/index'
    };
  }
});
