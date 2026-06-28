// pages/cannon/result/result.ts
import { Game, Match } from '../../../types/index';
import { calcGameTotalScores, getScoreChanges, getCannonStats } from '../../../utils/score-engine';
import { gameApi, memberApi } from '../../../utils/api';

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
  totalScored: number;
  totalConceded: number;
  netScore: number;
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
        if (m.winner === '') return 0;
        const aWins = (aInA && m.winner === 'A') || (aInB && m.winner === 'B');
        return aWins ? -1 : 1;
      }
    }
    return 0;
  },

  calcResults(gd: GameData) {
    const finishedMatches = gd.matches.filter(m => m.status === 'finished');
    const scoreMap = calcGameTotalScores(finishedMatches, gd.cannonWeight, gd.players);
    const playerPoints = this.calcPlayerPoints(finishedMatches, gd.players);
    const stats = getCannonStats(finishedMatches);

    const memberMap = new Map(gd.members.map(m => [m._id, m]));

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

    if (gd.mode === 'blind_cannon') {
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
      entries.sort((a, b) => b.points - a.points);
    }
    entries.forEach((e, i) => { e.rank = i + 1; });

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

  /** 保存比赛到自部署后端 */
  async saveGame(gd: GameData) {
    const playerDetails = gd.members.map(m => ({
      _id: m._id,
      nickname: m.nickname,
      avatarUrl: m.avatarUrl || '',
      gender: m.gender ?? 1
    }));

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

    try {
      const result = await gameApi.create(gameRecord);
      this.setData({ saved: true, gameId: result._id! });
      this.updateMemberStats(gd.players);
    } catch (err) {
      console.error('保存比赛失败，使用本地缓存', err);
      const localId = `local_${Date.now()}`;
      const cached = wx.getStorageSync('games') || [];
      cached.unshift({ ...gameRecord, _id: localId });
      wx.setStorageSync('games', cached.slice(0, 50));
      wx.setStorageSync('recentGames', cached.slice(0, 5));
      this.setData({ saved: true, gameId: localId });
    }
  },

  /** 更新队员统计（自部署后端：读 → 合并 → 写） */
  async updateMemberStats(players: string[]) {
    const scoreMap: Record<string, number> = {};
    this.data.scoreEntries.forEach(e => { scoreMap[e.memberId] = e.score; });

    for (const pid of players) {
      const score = scoreMap[pid] || 0;
      try {
        const member = await memberApi.get(pid);
        const updates: any = {
          stats: {
            totalScore: (member.stats.totalScore || 0) + score,
            totalGames: (member.stats.totalGames || 0) + 1,
            maxSingleScore: Math.max(member.stats.maxSingleScore || 0, score),
            cannonKingCount: (member.stats.cannonKingCount || 0) + (score > 0 && pid === this.data.mvp.memberId ? 1 : 0),
            timesCannoned: member.stats.timesCannoned || 0
          }
        };
        await memberApi.update(pid, updates);
      } catch {
        // 离线或本地选手：静默跳过
      }
    }
  },

  /** 进入炮费分摊 */
  onGoBilling() {
    const app = getApp<IAppOption>();
    const gd = app.globalData.currentGame as GameData;
    const playerNames: Record<string, string> = {};
    this.data.scoreEntries.forEach(e => { playerNames[e.memberId] = e.name; });
    wx.setStorageSync('billingGameData', {
      name: gd?.name || this.data.gameName,
      mode: gd?.mode || this.data.mode,
      cannonWeight: gd?.cannonWeight || this.data.cannonWeight,
      players: gd?.players || [],
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
    const { gameName, mode, scoreEntries, gameId } = this.data;
    const app = getApp<IAppOption>();
    const gd = app.globalData.currentGame as GameData;

    let title = '';

    if (mode === 'blind_cannon' && gd) {
      const players = gd.players;
      const pairResults: { name1: string; name2: string; wins: number; losses: number }[] = [];
      for (let i = 0; i < players.length; i += 2) {
        const e1 = scoreEntries.find(e => e.memberId === players[i]);
        const e2 = scoreEntries.find(e => e.memberId === players[i + 1]);
        if (e1 && e2) {
          pairResults.push({
            name1: e1.name,
            name2: e2.name,
            wins: e1.wins,
            losses: e1.losses
          });
        }
      }
      pairResults.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
      const best = pairResults[0];
      if (best) {
        title = `「${gameName}」战报：${best.name1} & ${best.name2} ${best.wins}胜${best.losses}负！`;
      } else {
        title = `「${gameName}」战报`;
      }
    } else {
      const top = scoreEntries[0];
      if (top) {
        const netSign = top.netScore > 0 ? '+' : '';
        title = `「${gameName}」战报：${top.name} ${top.wins}胜${top.losses}负，净胜${netSign}${top.netScore}！`;
      } else {
        title = `「${gameName}」战报`;
      }
    }

    // 分享路径带上 gameId，接收者打开后跳转详情页
    const sharePath = gameId
      ? `/pages/arsenal/detail/detail?id=${gameId}`
      : '/pages/index/index';

    return {
      title,
      path: sharePath,
      imageUrl: ''
    };
  }
});
