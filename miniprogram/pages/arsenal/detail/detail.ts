// pages/arsenal/detail/detail.ts
import { Game } from '../../../types/index';

Page({
  data: {
    game: null as Game | null,
    scoreEntries: [] as { name: string; score: number; rank: number }[],
    memberMap: {} as Record<string, string>
  },

  onLoad(options: any) {
    const id = options.id;
    if (!id) return;
    this.loadGame(id);
  },

  async loadGame(id: string) {
    const db = wx.cloud.database();
    try {
      const res = await db.collection('games').doc(id).get();
      this.processGame(res.data as Game);
    } catch {
      const cached = (wx.getStorageSync('games') || []).find((g: any) => g._id === id);
      if (cached) this.processGame(cached);
    }
  },

  processGame(game: Game) {
    const entries = Object.entries(game.cannonScores || {})
      .map(([mid, score]) => ({ memberId: mid, name: mid.slice(0, 8), score }))
      .sort((a, b) => b.score - a.score);

    entries.forEach((e, i) => { e.name = `${e.memberId.slice(0, 6)}`; Object.assign(e, { rank: i + 1 }); });

    this.setData({ game, scoreEntries: entries as any });
  },

  onReplay() {
    const game = this.data.game;
    if (game) {
      wx.navigateTo({
        url: `/pages/cannon/create/create?mode=${game.playMode}&replay=${game._id}`
      });
    }
  }
});
