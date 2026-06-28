// pages/index/index.ts
import { PlayModeConfig } from '../../types/index';
import { PLAY_MODES } from '../../utils/play-modes';
import { gameApi } from '../../utils/api';

Page({
  data: {
    playModes: PLAY_MODES,
    recentGames: [] as any[],
    showEmpty: true,
    cannonSlogan: '羽球爱好者自己的计分器'
  },

  onShow() {
    this.loadRecentGames();
  },

  loadRecentGames() {
    gameApi.list(3)
      .then(games => {
        const formatted = games.map(g => ({
          ...g,
          timeShort: this.getTimeShort(g.createdAt),
          playModeName: this.getModeName(g.playMode)
        }));
        // 同步缓存
        wx.setStorageSync('recentGames', games);
        this.setData({
          recentGames: formatted,
          showEmpty: formatted.length === 0
        });
      })
      .catch(() => {
        // 离线模式：从缓存读
        const cached = wx.getStorageSync('recentGames') || [];
        const games = (cached as any[]).map(g => ({
          ...g,
          timeShort: this.getTimeShort(g.createdAt),
          playModeName: this.getModeName(g.playMode)
        }));
        this.setData({
          recentGames: games,
          showEmpty: games.length === 0
        });
      });
  },

  getTimeShort(isoStr?: string): string {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return ''; }
  },

  getModeName(modeId?: string): string {
    if (!modeId) return '';
    const found = PLAY_MODES.find(m => m.mode === modeId);
    return found ? found.name : modeId;
  },

  /** 选择玩法，跳转建局页 */
  onSelectMode(e: any) {
    const modeKey = e.currentTarget.dataset.mode as PlayMode;
    const config = PLAY_MODES.find(m => m.mode === modeKey);
    if (!config) return;
    wx.navigateTo({
      url: `/pages/cannon/create/create?mode=${config.mode}`
    });
  },

  /** 查看历史详情 */
  onViewDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/arsenal/detail/detail?id=${id}` });
  },

  /** 进入历史比赛 */
  onViewHistory() {
    wx.switchTab({ url: '/pages/arsenal/history/history' });
  },

  /** 分享 */
  onShareAppMessage() {
    return {
      title: '球局计分器 - 羽球爱好者自己的计分器',
      path: '/pages/index/index'
    };
  }
});
