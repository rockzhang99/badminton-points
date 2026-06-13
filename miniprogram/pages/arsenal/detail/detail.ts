// pages/arsenal/detail/detail.ts
import { Game, Match } from '../../../types/index';

interface ScoreEntry {
  memberId: string;
  name: string;
  avatar: string;
  wins: number;
  losses: number;
  netScore: number;   // 胜分 - 负分
  cannonScore: number; // 炮分
  rank: number;
}

Page({
  data: {
    game: null as any,
    scoreEntries: [] as ScoreEntry[],
    activeTab: 'rank' as 'rank' | 'matches',
    playerCount: 0,
    totalMatches: 0,
    // Tab 切换用
    tabRankActive: true,
    tabMatchActive: false
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
      this.processGame(res.data as any);
    } catch {
      const cached = (wx.getStorageSync('games') || []).find((g: any) => g._id === id);
      if (cached) this.processGame(cached);
    }
  },

  /** 构建 ID -> 昵称 映射 */
  buildNameMap(game: any): Record<string, { nickname: string; avatarUrl: string }> {
    const map: Record<string, { nickname: string; avatarUrl: string }> = {};

    // 优先从 playerDetails 取（保存比赛时写入的）
    if (game.playerDetails && Array.isArray(game.playerDetails)) {
      for (const p of game.playerDetails) {
        map[p._id] = { nickname: p.nickname || p._id.slice(0, 6), avatarUrl: p.avatarUrl || '' };
      }
    }

    // 兜底：如果 players 是对象数组格式（临时选手）
    if (game.players && Array.isArray(game.players)) {
      for (const p of game.players) {
        if (typeof p === 'object' && p.id && !map[p.id]) {
          map[p.id] = { nickname: p.nickname || p.id.slice(0, 6), avatarUrl: '' };
        }
      }
    }

    return map;
  },

  /** 根据 ID 列表解析为名字字符串 */
  resolveNames(ids: string[], nameMap: Record<string, { nickname: string; avatarUrl: string }>): string {
    if (!ids || !ids.length) return '-';
    return ids.map(id => nameMap[id]?.nickname || id.slice(0, 6)).join(' ');
  },

  processGame(game: any) {
    const nameMap = this.buildNameMap(game);

    // ---- 计算每个选手的胜负场次和净胜分 ----
    const winLossMap: Record<string, { wins: number; losses: number; netScore: number }> = {};

    // 初始化所有选手
    const playerIds = (game.players || []).map((p: any) => typeof p === 'string' ? p : p.id);
    for (const pid of playerIds) {
      winLossMap[pid] = { wins: 0, losses: 0, netScore: 0 };
    }

    // 遍历已结束的比赛统计胜负
    const finishedMatches = (game.matches || []).filter((m: Match) => m.status === 'finished');
    for (const m of finishedMatches) {
      const teamAIds = m.teamA || [];
      const teamBIds = m.teamB || [];
      const scoreA = m.scoreA || 0;
      const scoreB = m.scoreB || 0;

      // A队每人记录
      for (const aid of teamAIds) {
        if (!winLossMap[aid]) winLossMap[aid] = { wins: 0, losses: 0, netScore: 0 };
        if (m.winner === 'A') {
          winLossMap[aid].wins++;
          winLossMap[aid].netScore += scoreA - scoreB;
        } else {
          winLossMap[aid].losses++;
          winLossMap[aid].netScore += scoreA - scoreB;  // 负场净胜分为负
        }
      }

      // B队每人记录
      for (const bid of teamBIds) {
        if (!winLossMap[bid]) winLossMap[bid] = { wins: 0, losses: 0, netScore: 0 };
        if (m.winner === 'B') {
          winLossMap[bid].wins++;
          winLossMap[bid].netScore += scoreB - scoreA;
        } else {
          winLossMap[bid].losses++;
          winLossMap[bid].netScore += scoreB - scoreA;
        }
      }
    }

    // ---- 构建排名条目 ----
    const entries: ScoreEntry[] = [];
    for (const pid of Object.keys(winLossMap)) {
      const wl = winLossMap[pid];
      const info = nameMap[pid];
      entries.push({
        memberId: pid,
        name: info?.nickname || pid.slice(0, 6),
        avatar: info?.avatarUrl || '',
        wins: wl.wins,
        losses: wl.losses,
        netScore: wl.netScore,
        cannonScore: (game.cannonScores && game.cannonScores[pid]) || 0,
        rank: 0
      });
    }

    // 按炮分降序排列
    entries.sort((a, b) => b.cannonScore - a.cannonScore);

    // 赋名次
    entries.forEach((e, i) => { e.rank = i + 1; });

    // 对阵记录中补充名字（创建新的 matchesWithNames）
    const matchesWithNames = finishedMatches.map((m: Match) => ({
      ...m,
      teamANames: this.resolveNames(m.teamA, nameMap),
      teamBNames: this.resolveNames(m.teamB, nameMap)
    }));

    this.setData({
      game,
      scoreEntries: entries,
      matchesWithNames,
      playerCount: playerIds.length,
      totalMatches: finishedMatches.length
    });
  },

  /** Tab 切换 */
  onSwitchTab(e: any) {
    const tab = e.currentTarget.dataset.tab as string;
    this.setData({
      activeTab: tab,
      tabRankActive: tab === 'rank',
      tabMatchActive: tab === 'matches'
    });
  },

  onReplay() {
    const game = this.data.game;
    if (game) {
      wx.navigateTo({
        url: `/pages/cannon/create/create?mode=${game.playMode}&replay=${game._id}`
      });
    }
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
