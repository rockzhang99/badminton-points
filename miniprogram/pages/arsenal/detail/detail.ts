// pages/arsenal/detail/detail.ts
import { Game, Match } from '../../../types/index';
import { PLAY_MODES } from '../../../utils/play-modes';
import { gameApi } from '../../../utils/api';

/** 根据 mode ID 获取可读名称 */
function getModeName(modeId?: string): string {
  if (!modeId) return '';
  const found = PLAY_MODES.find(m => m.mode === modeId);
  return found ? found.name : modeId;
}

interface ScoreEntry {
  memberId: string;
  name: string;
  avatar: string;
  gender: number;
  wins: number;
  losses: number;
  netScore: number;
  cannonScore: number;
  rank: number;
}

interface PairScoreEntry {
  id: string;
  player1Name: string;
  player1Gender: number;
  player1Avatar: string;
  player2Name: string;
  player2Gender: number;
  player2Avatar: string;
  points: number;
  wins: number;
  losses: number;
  netScore: number;
  cannonScore: number;
  rank: number;
}

interface PlayerNameInfo {
  name: string;
  gender: number;
}

Page({
  data: {
    game: null as any,
    modeDisplayName: '',
    scoreEntries: [] as ScoreEntry[],
    pairEntries: [] as PairScoreEntry[],
    isBlindCannon: false,
    activeTab: 'rank' as 'rank' | 'matches',
    playerCount: 0,
    totalMatches: 0,
    tabRankActive: true,
    tabMatchActive: false
  },

  onLoad(options: any) {
    const id = options.id;
    if (!id) return;
    this.loadGame(id);
  },

  async loadGame(id: string) {
    try {
      const res = await gameApi.get(id);
      this.processGame(res);
    } catch {
      const cached = (wx.getStorageSync('games') || []).find((g: any) => g._id === id);
      if (cached) this.processGame(cached);
    }
  },

  buildNameMap(game: any): Record<string, { nickname: string; avatarUrl: string; gender: number }> {
    const map: Record<string, { nickname: string; avatarUrl: string; gender: number }> = {};

    if (game.playerDetails && Array.isArray(game.playerDetails)) {
      for (const p of game.playerDetails) {
        map[p._id] = { nickname: p.nickname || p._id.slice(0, 6), avatarUrl: p.avatarUrl || '', gender: p.gender ?? 1 };
      }
    }

    if (game.players && Array.isArray(game.players)) {
      for (const p of game.players) {
        if (typeof p === 'object' && p.id && !map[p.id]) {
          map[p.id] = { nickname: p.nickname || p.id.slice(0, 6), avatarUrl: '', gender: p.gender ?? 1 };
        }
      }
    }

    return map;
  },

  formatGameTitle(game: any): string {
    const base = game.name || '';
    if (!game.createdAt) return base;
    try {
      const d = new Date(game.createdAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${base} ${hh}:${mm}`;
    } catch {
      return base;
    }
  },

  resolveNamesWithGender(ids: string[], nameMap: Record<string, { nickname: string; avatarUrl: string; gender: number }>): PlayerNameInfo[] {
    if (!ids || !ids.length) return [];
    return ids.map(id => ({
      name: nameMap[id]?.nickname || id.slice(0, 6),
      gender: nameMap[id]?.gender ?? 1
    }));
  },

  processGame(game: any) {
    const nameMap = this.buildNameMap(game);
    const displayName = this.formatGameTitle(game);

    const winLossMap: Record<string, { wins: number; losses: number; netScore: number }> = {};

    const playerIds = (game.players || []).map((p: any) => typeof p === 'string' ? p : p.id);
    for (const pid of playerIds) {
      winLossMap[pid] = { wins: 0, losses: 0, netScore: 0 };
    }

    const finishedMatches = (game.matches || []).filter((m: Match) => m.status === 'finished');
    for (const m of finishedMatches) {
      const teamAIds = m.teamA || [];
      const teamBIds = m.teamB || [];
      const scoreA = m.scoreA || 0;
      const scoreB = m.scoreB || 0;

      for (const aid of teamAIds) {
        if (!winLossMap[aid]) winLossMap[aid] = { wins: 0, losses: 0, netScore: 0 };
        if (m.winner === 'A') {
          winLossMap[aid].wins++;
          winLossMap[aid].netScore += scoreA - scoreB;
        } else {
          winLossMap[aid].losses++;
          winLossMap[aid].netScore += scoreA - scoreB;
        }
      }

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

    const entries: ScoreEntry[] = [];
    for (const pid of Object.keys(winLossMap)) {
      const wl = winLossMap[pid];
      const info = nameMap[pid];
      entries.push({
        memberId: pid,
        name: info?.nickname || pid.slice(0, 6),
        avatar: info?.avatarUrl || '',
        gender: info?.gender ?? 1,
        wins: wl.wins,
        losses: wl.losses,
        netScore: wl.netScore,
        cannonScore: (game.cannonScores && game.cannonScores[pid]) || 0,
        rank: 0
      });
    }

    entries.sort((a, b) => (b.wins - a.wins) || (b.netScore - a.netScore));
    entries.forEach((e, i) => { e.rank = i + 1; });

    const isBlindCannon = game.playMode === 'blind_cannon';
    let pairEntries: PairScoreEntry[] = [];
    if (isBlindCannon) {
      for (let i = 0; i < entries.length; i += 2) {
        const p1 = entries[i];
        const p2 = entries[i + 1];
        if (!p1 || !p2) break;
        pairEntries.push({
          id: `pair_${i / 2}`,
          player1Name: p1.name,
          player1Gender: p1.gender,
          player1Avatar: p1.avatar,
          player2Name: p2.name,
          player2Gender: p2.gender,
          player2Avatar: p2.avatar,
          points: p1.wins * 2,
          wins: p1.wins,
          losses: p1.losses,
          netScore: p1.netScore + p2.netScore,
          cannonScore: p1.cannonScore + p2.cannonScore,
          rank: 0
        });
      }
      pairEntries.sort((a, b) =>
        (b.points - a.points) ||
        (b.wins - a.wins) ||
        (b.netScore - a.netScore)
      );
      pairEntries.forEach((e, i) => { e.rank = i + 1; });
    }

    const matchesWithNames = finishedMatches.map((m: Match) => ({
      ...m,
      teamANames: this.resolveNamesWithGender(m.teamA, nameMap),
      teamBNames: this.resolveNamesWithGender(m.teamB, nameMap)
    }));

    this.setData({
      game: { ...game, name: displayName },
      scoreEntries: entries,
      pairEntries,
      isBlindCannon,
      matchesWithNames,
      playerCount: playerIds.length,
      totalMatches: finishedMatches.length,
      modeDisplayName: getModeName(game.playMode)
    });
  },

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
