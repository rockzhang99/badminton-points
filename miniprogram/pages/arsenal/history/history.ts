// pages/arsenal/history/history.ts
import { Game } from '../../../types/index';

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
      this.setData({ games: res.data as Game[] });
    } catch {
      const cached = wx.getStorageSync('games') || [];
      this.setData({ games: cached });
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
