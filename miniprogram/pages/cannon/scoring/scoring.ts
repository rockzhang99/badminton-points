// pages/cannon/scoring/scoring.ts
import { Match } from '../../../types/index';
import { calcMatchScores } from '../../../utils/score-engine';

interface GameData {
  mode: string;
  name: string;
  cannonWeight: number;
  matches: Match[];
  players: string[];
  members: any[];
  soundEnabled: boolean;
}

Page({
  data: {
    gameName: '',
    cannonWeight: 1.0,
    matches: [] as Match[],
    members: [] as any[],
    soundEnabled: true,

    // 当前场地
    currentCourt: 0,

    // 进度
    finishedCount: 0,
    totalCount: 0,
    progress: 0,

    // 对阵信息（computed）
    teamAName0: '',
    teamAName1: '',
    teamBName0: '',
    teamBName1: '',

    // 性别图标（computed）
    teamAGender0: 1,
    teamAGender1: 1,
    teamBGender0: 1,
    teamBGender1: 1,

    // 发球方指示
    servingSide: 'right' as 'left' | 'right'
  },

  onLoad() {
    const app = getApp<IAppOption>();
    const gameData = app.globalData.currentGame as GameData;

    if (!gameData) {
      wx.showToast({ title: '数据丢失，请重新建局', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 初始化每场的 teamA/B 人数（用于一炮定乾坤单人赛的显示适配）
    const matches = gameData.matches.map(m => ({
      ...m,
      scoreA: m.scoreA || 0,
      scoreB: m.scoreB || 0,
      winner: m.winner || '',
      status: m.status || 'pending',
      cannonEvents: []
    }));

    const totalCount = matches.filter(m => m.teamA.length > 0 && m.teamB.length > 0).length;

    this.setData({
      gameName: gameData.name,
      cannonWeight: gameData.cannonWeight,
      matches,
      members: gameData.members,
      soundEnabled: gameData.soundEnabled,
      totalCount,
      finishedCount: matches.filter(m => m.status === 'finished').length
    });

    this.updateProgress();
    this.updateTeamNames();
  },

  /** 切换场地（swiper change） */
  onCourtChange(e: any) {
    this.setData({ currentCourt: e.detail.current });
    this.updateTeamNames();
  },

  /** 更新选手名称显示（支持单双打自适应） */
  updateTeamNames() {
    const match = this.data.matches[this.data.currentCourt];
    if (!match) return;

    const g = (id: string) => {
      if (!id) return 1;
      const m = this.data.members.find((x: any) => x._id === id);
      return m?.gender ?? 1;
    };

    this.setData({
      teamAName0: this.getMemberName(match.teamA[0]),
      teamAGender0: g(match.teamA[0]),
      teamAName1: match.teamA.length > 1 ? this.getMemberName(match.teamA[1]) : '',
      teamAGender1: g(match.teamA.length > 1 ? match.teamA[1] : ''),
      teamBName0: this.getMemberName(match.teamB[0]),
      teamBGender0: g(match.teamB[0]),
      teamBName1: match.teamB.length > 1 ? this.getMemberName(match.teamB[1]) : '',
      teamBGender1: g(match.teamB.length > 1 ? match.teamB[1] : '')
    });
  },

  /** 获取队员昵称 */
  getMemberName(id: string): string {
    if (!id) return '';
    const m = this.data.members.find((x: any) => x._id === id);
    return m?.nickname || id.slice(0, 6);
  },

  /** A队 +1 */
  onAddA() { this.updateScore('A', 1); },

  /** A队 -1 */
  onMinusA() { this.updateScore('A', -1); },

  /** B队 +1 */
  onAddB() { this.updateScore('B', 1); },

  /** B队 -1 */
  onMinusB() { this.updateScore('B', -1); },

  /** 更新比分 */
  updateScore(team: 'A' | 'B', delta: number) {
    const idx = this.data.currentCourt;
    const matches = [...this.data.matches];
    const match = { ...matches[idx] };

    if (team === 'A') {
      match.scoreA = Math.max(0, match.scoreA + delta);
    } else {
      match.scoreB = Math.max(0, match.scoreB + delta);
    }

    match.status = 'playing';
    matches[idx] = match;
    this.setData({ matches });
  },

  /** 快速比分预设 */
  onQuickScore(e: any) {
    const a = parseInt(e.currentTarget.dataset.a);
    const b = parseInt(e.currentTarget.dataset.b);
    const idx = this.data.currentCourt;
    const matches = [...this.data.matches];
    const match = { ...matches[idx] };
    match.scoreA = a;
    match.scoreB = b;
    match.status = 'playing';
    matches[idx] = match;
    this.setData({ matches });
  },

  /** 重置当前场比分 */
  onResetScore() {
    wx.showModal({
      title: '重置比分',
      content: '确定要重置当前场次比分吗？',
      success: res => {
        if (res.confirm) {
          const idx = this.data.currentCourt;
          const matches = [...this.data.matches];
          matches[idx] = {
            ...matches[idx],
            scoreA: 0,
            scoreB: 0,
            winner: '',
            status: 'pending'
          };
          this.setData({ matches });
        }
      }
    });
  },

  /** 下一场 → 自动结束当前局（判定胜负）并跳转 */
  onNextCourt() {
    const idx = this.data.currentCourt;
    const match = this.data.matches[idx];

    // 自动结束当前局：有分差就判胜
    if (match.scoreA !== match.scoreB && match.status !== 'finished') {
      this.finishCurrentMatch();
    }

    // 跳到下一场
    const total = this.data.totalCount;
    let next = idx + 1;
    while (next < total && (this.data.matches[next].teamA.length === 0 || this.data.matches[next].teamB.length === 0)) {
      next++;
    }
    if (next < total) {
      this.setData({ currentCourt: next });
      this.updateTeamNames();
    } else {
      wx.showToast({ title: '已是最后一场', icon: 'none' });
    }
  },

  /** 结束当前场：判定胜负、标记 finished */
  finishCurrentMatch() {
    const idx = this.data.currentCourt;
    const matches = [...this.data.matches];
    const match = { ...matches[idx] };

    if (match.scoreA === match.scoreB) return; // 平局不结束

    match.winner = match.scoreA > match.scoreB ? 'A' : 'B';
    match.status = 'finished';
    matches[idx] = match;
    this.setData({ matches });
    this.updateProgress();

    wx.showToast({ title: `${match.winner === 'A' ? 'A队' : 'B队'} 获胜！`, icon: 'success' });
  },

  /** 重新开打（已结束的比赛恢复为进行中） */
  onReopenMatch() {
    const idx = this.data.currentCourt;
    const matches = [...this.data.matches];
    matches[idx] = {
      ...matches[idx],
      status: 'playing',
      winner: ''
    };
    this.setData({ matches });
    this.updateProgress();
  },

  /** 更新进度 */
  updateProgress() {
    const finished = this.data.matches.filter(m => m.status === 'finished').length;
    const total = this.data.totalCount;
    this.setData({
      finishedCount: finished,
      progress: total > 0 ? Math.round((finished / total) * 100) : 0
    });
  },

  /** 全部结束，跳转结果页 */
  onFinishAll() {
    const unfinished = this.data.matches.filter(m => {
      // 跳过空对阵（自由炮局中无队员的占位）
      if (m.teamA.length === 0 || m.teamB.length === 0) return false;
      return m.status !== 'finished';
    });

    if (unfinished.length > 0) {
      wx.showModal({
        title: '还有未完成的比赛',
        content: `还有 ${unfinished.length} 场比赛未完成，确认结束吗？`,
        success: res => {
          if (res.confirm) this.goToResult();
        }
      });
    } else {
      this.goToResult();
    }
  },

  /** 跳转结果页 */
  goToResult() {
    const app = getApp<IAppOption>();
    app.globalData.currentGame = {
      name: this.data.gameName,
      cannonWeight: this.data.cannonWeight,
      matches: this.data.matches,
      players: this.data.matches.reduce((acc: string[], m: Match) => {
        for (const p of [...m.teamA, ...m.teamB]) {
          if (!acc.includes(p)) acc.push(p);
        }
        return acc;
      }, [] as string[]),
      members: this.data.members,
      mode: (app.globalData.currentGame as GameData)?.mode || 'free_cannon',
      soundEnabled: this.data.soundEnabled
    };

    wx.redirectTo({ url: '/pages/cannon/result/result' });
  },

});
