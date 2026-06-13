// pages/cannon/result/result.ts
import { Game, Match } from '../../../types/index';
import { calcGameTotalScores, getScoreChanges, getCannonStats } from '../../../utils/score-engine';

interface GameData {
  name: string;
  cannonWeight: number;
  matches: Match[];
  players: string[];
  members: any[];
  mode: string;
  soundEnabled: boolean;
}

Page({
  data: {
    gameName: '',
    cannonWeight: 1.0,
    mode: '',

    // 炮分结果
    scoreMap: {} as Record<string, number>,
    scoreEntries: [] as { memberId: string; name: string; avatar: string; score: number; rank: number; change: string; netWins: number; gender: number }[],

    // 炮击统计
    mostCannoned: { name: '', count: 0 },
    mostFired: { name: '', count: 0 },

    // MVP
    mvp: { name: '', avatar: '', score: 0 } as any,

    // 状态
    saved: false,
    gameId: ''
  },

  onLoad() {
    const app = getApp<IAppOption>();
    const gd = app.globalData.currentGame as GameData;
    if (!gd) {
      wx.showToast({ title: '数据丢失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({
      gameName: gd.name,
      cannonWeight: gd.cannonWeight,
      mode: gd.mode
    });

    this.calcResults(gd);
    this.saveGame(gd);
  },

  calcResults(gd: GameData) {
    const finishedMatches = gd.matches.filter(m => m.status === 'finished');
    const scoreMap = calcGameTotalScores(finishedMatches, gd.cannonWeight, gd.players);
    const changes = getScoreChanges(finishedMatches, gd.cannonWeight, gd.players);
    const stats = getCannonStats(finishedMatches);

    const memberMap = new Map(gd.members.map(m => [m._id, m]));

    // 按得分排序
    const entries = gd.players
      .map(pid => {
        const m = memberMap.get(pid);
        const change = changes.find(c => c.memberId === pid);
        // 从 change breakdown 解析 净胜分，如 "6胜1负" → netWins=5
        const netMatch = (change?.breakdown || '').match(/(\d+)胜(\d+)负/);
        const netWins = netMatch ? parseInt(netMatch[1]) - parseInt(netMatch[2]) : 0;
        return {
          memberId: pid,
          name: m?.nickname || pid.slice(0, 6),
          avatar: m?.avatarUrl || '',
          gender: m?.gender ?? 1,
          score: scoreMap[pid] || 0,
          rank: 0,
          change: change?.breakdown || '',
          netWins
        };
      })
      .sort((a, b) => b.score - a.score);

    // 赋排名
    entries.forEach((e, i) => { e.rank = i + 1; });

    // MVP
    const mvp = entries[0] || { name: '', avatar: '', score: 0 };
    const mostCannoned = stats.mostCannoned;
    const mostFired = stats.mostFired;

    this.setData({
      scoreMap,
      scoreEntries: entries,
      mvp: { name: mvp.name, avatar: mvp.avatar, score: mvp.score },
      mostCannoned: {
        name: mostCannoned ? (memberMap.get(mostCannoned.memberId)?.nickname || '') : '',
        count: mostCannoned?.count || 0
      },
      mostFired: {
        name: mostFired ? (memberMap.get(mostFired.memberId)?.nickname || '') : '',
        count: mostFired?.count || 0
      }
    });
  },

  /** 保存比赛到云数据库 */
  saveGame(gd: GameData) {
    const db = wx.cloud.database();
    // 同时保存选手详情（昵称），用于历史回放和重赛
    const playerDetails = gd.members.map(m => ({
      _id: m._id,
      nickname: m.nickname,
      avatarUrl: m.avatarUrl || ''
    }));

    const gameRecord = {
      name: gd.name,
      playMode: gd.mode,
      cannonWeight: gd.cannonWeight,
      status: 'finished',
      players: gd.players,
      playerDetails,
      matches: gd.matches,
      cannonScores: this.data.scoreMap,
      createdBy: getApp<IAppOption>().globalData.userInfo?.openid || '',
      createdAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    };

    db.collection('games').add({ data: gameRecord })
      .then((res: any) => {
        this.setData({ saved: true, gameId: res._id });
        this.updateMemberStats(gd.players);
      })
      .catch(err => {
        console.error('保存比赛失败，使用本地缓存', err);
        const cached = wx.getStorageSync('games') || [];
        cached.unshift({ ...gameRecord, _id: `local_${Date.now()}` });
        wx.setStorageSync('games', cached.slice(0, 50));
        wx.setStorageSync('recentGames', cached.slice(0, 5));
        this.setData({ saved: true });
      });
  },

  /** 更新队员统计 */
  updateMemberStats(players: string[]) {
    const db = wx.cloud.database();
    const scoreMap = this.data.scoreMap;

    players.forEach(pid => {
      const score = scoreMap[pid] || 0;
      db.collection('members').doc(pid).get().then((res: any) => {
        const member = res.data;
        const updates: any = {
          'stats.totalScore': db.command.inc(score),
          'stats.totalGames': db.command.inc(1),
          'stats.maxSingleScore': Math.max(member.stats?.maxSingleScore || 0, score)
        };
        // 如果本场第一，炮王次数+1
        if (score > 0 && pid === this.data.mvp.memberId) {
          updates['stats.cannonKingCount'] = db.command.inc(1);
        }
        return db.collection('members').doc(pid).update({ data: updates });
      }).catch(() => {});
    });
  },

  /** 进入炮费分摊 */
  onGoBilling() {
    // 把当前比赛数据存到本地缓存，确保算账页能读到（不依赖云端回读）
    const app = getApp<IAppOption>();
    const gd = app.globalData.currentGame as GameData;
    // 直接用结果页已解析好的 scoreEntries 构造队员信息，确保昵称100%正确
    const playerNames: Record<string, string> = {};
    this.data.scoreEntries.forEach(e => { playerNames[e.memberId] = e.name; });
    wx.setStorageSync('billingGameData', {
      name: gd?.name || this.data.gameName,
      mode: gd?.mode || this.data.mode,
      cannonWeight: gd?.cannonWeight || this.data.cannonWeight,
      players: gd?.players || [],
      // 用 scoreEntries 中确认的 映射关系，算账页直接取名字
      playerNames,
      playerDetails: (gd?.members || []).map((m: any) => ({
        _id: m._id,
        nickname: playerNames[m._id] || m.nickname || '',
        gender: m.gender ?? 1,
        avatarUrl: m.avatarUrl || ''
      })),
      cannonScores: this.data.scoreMap,
      matches: gd?.matches || []
    });
    wx.navigateTo({
      url: `/pages/settlement/billing/billing?gameId=${this.data.gameId}`
    });
  },

  /** 再来一局 */
  onPlayAgain() {
    wx.redirectTo({
      url: `/pages/cannon/create/create?mode=${this.data.mode}`
    });
  },

  /** 返回首页 */
  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  /** 分享战绩 */
  onShareAppMessage() {
    const mvp = this.data.mvp;
    return {
      title: `${mvp.name} 在「${this.data.gameName}」中轰下 ${mvp.score} 炮分！`,
      path: '/pages/index/index',
      imageUrl: '' // 可生成分享图
    };
  }
});
