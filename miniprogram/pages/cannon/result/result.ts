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
}

/** 选手比赛得分统计 */
interface PlayerPoints {
  memberId: string;
  totalScored: number;   // 本方总得分
  totalConceded: number; // 对方总得分
  netScore: number;      // 净胜分 = totalScored - totalConceded
  wins: number;
  losses: number;
}

Page({
  data: {
    gameName: '',
    cannonWeight: 1.0,
    mode: '',

    // 比赛结果
    scoreEntries: [] as { memberId: string; name: string; avatar: string; gender: number; points: number; netScore: number; wins: number; losses: number; rank: number }[],

    // 炮击统计
    mostCannoned: { name: '', count: 0 },
    mostFired: { name: '', count: 0 },

    // MVP（按炮分）
    mvp: { memberId: '', name: '', avatar: '', score: 0, points: 0 } as any,

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

  /** 计算每位选手的比赛总得分、净胜分、胜负记录 */
  calcPlayerPoints(finishedMatches: Match[], players: string[]): PlayerPoints[] {
    const pointsMap: Record<string, PlayerPoints> = {};
    for (const pid of players) {
      pointsMap[pid] = { memberId: pid, totalScored: 0, totalConceded: 0, netScore: 0, wins: 0, losses: 0 };
    }

    for (const match of finishedMatches) {
      // 该场所有选手都按团队比分累积
      for (const pid of match.teamA) {
        if (!pointsMap[pid]) continue;
        pointsMap[pid].totalScored += match.scoreA;
        pointsMap[pid].totalConceded += match.scoreB;
        if (match.winner === 'A') pointsMap[pid].wins++;
        else if (match.winner === 'B') pointsMap[pid].losses++;
      }
      for (const pid of match.teamB) {
        if (!pointsMap[pid]) continue;
        pointsMap[pid].totalScored += match.scoreB;
        pointsMap[pid].totalConceded += match.scoreA;
        if (match.winner === 'B') pointsMap[pid].wins++;
        else if (match.winner === 'A') pointsMap[pid].losses++;
      }
    }

    const result = Object.values(pointsMap);
    result.forEach(p => { p.netScore = p.totalScored - p.totalConceded; });
    return result;
  },

  /** 胜负关系判定：返回 a 对 b 的直接对话结果 */
  getHeadToHead(aId: string, bId: string, matches: Match[]): number {
    for (const m of matches) {
      const aInA = m.teamA.includes(aId);
      const aInB = m.teamB.includes(aId);
      const bInA = m.teamA.includes(bId);
      const bInB = m.teamB.includes(bId);
      if ((aInA && bInB) || (aInB && bInA)) {
        // a和b直接对抗
        if (m.winner === '') return 0;
        const aWins = (aInA && m.winner === 'A') || (aInB && m.winner === 'B');
        return aWins ? -1 : 1; // a赢 → a排前面(-1), b赢 → b排前面(1)
      }
    }
    return 0;
  },

  calcResults(gd: GameData) {
    const finishedMatches = gd.matches.filter(m => m.status === 'finished');
    // 炮分用于MVP判定
    const scoreMap = calcGameTotalScores(finishedMatches, gd.cannonWeight, gd.players);
    // 比赛得分统计
    const playerPoints = this.calcPlayerPoints(finishedMatches, gd.players);
    const stats = getCannonStats(finishedMatches);

    const memberMap = new Map(gd.members.map(m => [m._id, m]));

    // 构建 entries
    const entries = gd.players
      .map(pid => {
        const m = memberMap.get(pid);
        const pp = playerPoints.find(p => p.memberId === pid);
        return {
          memberId: pid,
          name: m?.nickname || pid.slice(0, 6),
          avatar: m?.avatarUrl || '',
          gender: m?.gender ?? 1,
          points: pp?.totalScored || 0,
          netScore: pp?.netScore || 0,
          wins: pp?.wins || 0,
          losses: pp?.losses || 0,
          score: scoreMap[pid] || 0,
          rank: 0
        };
      });

    // 按排名规则排序
    if (gd.mode === 'blind_cannon') {
      // 固定搭循环赛：积分(2/胜) → 胜场数 → 胜负关系 → 净胜分 → 总得分
      entries.sort((a, b) => {
        const ptsA = a.wins * 2;
        const ptsB = b.wins * 2;
        if (ptsB !== ptsA) return ptsB - ptsA;
        if (b.wins !== a.wins) return b.wins - a.wins;
        const h2h = this.getHeadToHead(a.memberId, b.memberId, finishedMatches);
        if (h2h !== 0) return h2h;
        if (b.netScore !== a.netScore) return b.netScore - a.netScore;
        return b.points - a.points;
      });
    } else {
      // 普通模式：按比赛总得分排序
      entries.sort((a, b) => b.points - a.points);
    }
    entries.forEach((e, i) => { e.rank = i + 1; });

    // MVP（炮分最高者，独立于排名）
    const bestScore = Math.max(...entries.map(e => e.score));
    const mvpEntry = entries.find(e => e.score === bestScore) || entries[0];
    const mvp = mvpEntry || { memberId: '', name: '', avatar: '', score: 0, points: 0 };
    const mostCannoned = stats.mostCannoned;
    const mostFired = stats.mostFired;

    this.setData({
      scoreEntries: entries,
      mvp: { memberId: mvp.memberId, name: mvp.name, avatar: mvp.avatar, score: mvp.score, points: mvp.points },
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
    // 同时保存选手详情（昵称、性别），用于历史回放和重赛
    const playerDetails = gd.members.map(m => ({
      _id: m._id,
      nickname: m.nickname,
      avatarUrl: m.avatarUrl || '',
      gender: m.gender ?? 1
    }));

    // 计算炮分用于保存
    const finishedMatches = gd.matches.filter((m: Match) => m.status === 'finished');
    const cannonScores = calcGameTotalScores(finishedMatches, gd.cannonWeight, gd.players);

    const gameRecord = {
      name: gd.name,
      playMode: gd.mode,
      cannonWeight: gd.cannonWeight,
      status: 'finished',
      players: gd.players,
      playerDetails,
      matches: gd.matches,
      cannonScores,
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
        const localId = `local_${Date.now()}`;
        const cached = wx.getStorageSync('games') || [];
        cached.unshift({ ...gameRecord, _id: localId });
        wx.setStorageSync('games', cached.slice(0, 50));
        wx.setStorageSync('recentGames', cached.slice(0, 5));
        this.setData({ saved: true, gameId: localId });
      });
  },

  /** 更新队员统计 */
  updateMemberStats(players: string[]) {
    const db = wx.cloud.database();
    // 从 scoreEntries 构建炮分映射
    const scoreMap: Record<string, number> = {};
    this.data.scoreEntries.forEach(e => { scoreMap[e.memberId] = e.score; });

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
      cannonScores: this.data.scoreEntries.reduce((map: Record<string, number>, e) => { map[e.memberId] = e.score; return map; }, {}),
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
