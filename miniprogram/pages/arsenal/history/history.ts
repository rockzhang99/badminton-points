// pages/arsenal/history/history.ts
import { Game } from '../../../types/index';
import { PLAY_MODES } from '../../../utils/play-modes';

const modeNameMap = new Map(PLAY_MODES.map(m => [m.mode, m.name]));

/** 根据 mode ID 获取可读名称 */
function getModeName(modeId?: string): string {
  if (!modeId) return '';
  return modeNameMap.get(modeId) || modeId;
}

/** 从 ISO 字符串提取 HH:mm */
function getTimeShort(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch { return ''; }
}

Page({
  data: {
    games: [] as Game[],
    loading: false
  },

  onShow() {
    this.loadGames();
  },

  async loadGames() {
    this.setData({ loading: true });
    const db = wx.cloud.database();

    try {
      const res = await db.collection('games')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      this.setData({ games: (res.data as Game[]).map(g => ({ ...g, playModeName: getModeName(g.playMode), timeShort: getTimeShort(g.createdAt) })) });
    } catch {
      const cached = wx.getStorageSync('games') || [];
      this.setData({ games: (cached as Game[]).map(g => ({ ...g, playModeName: getModeName(g.playMode), timeShort: getTimeShort(g.createdAt) })) });
    }

    this.setData({ loading: false });
  },

  onViewDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/arsenal/detail/detail?id=${id}` });
  },

  onReplay(e: any) {
    const game = e.currentTarget.dataset.game as Game;
    wx.navigateTo({
      url: `/pages/cannon/create/create?mode=${game.playMode}&replay=${game._id}`
    });
  }
});
