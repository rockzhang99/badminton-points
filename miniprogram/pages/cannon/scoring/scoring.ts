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
}

Page({
  data: {
    gameName: '',
    cannonWeight: 1.0,
    matches: [] as Match[],
    members: [] as any[],

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

  /**
   * 校验最终比分是否符合羽毛球21分制
   * 规则：先得21分且领先2分胜，或先到30分胜
   * 同时防止 10:22 这种不可达比分（领先方过21时对手不到20分，应在21:10时已结束）
   */
  isValidFinalScore(scoreA: number, scoreB: number): boolean {
    if (scoreA === scoreB) return false;
    const maxScore = Math.max(scoreA, scoreB);
    const minScore = Math.min(scoreA, scoreB);
    const gap = maxScore - minScore;

    // 先到30分胜
    if (maxScore >= 30) return true;

    // 必须至少到21分
    if (maxScore < 21) return false;

    // 必须领先至少2分
    if (gap < 2) return false;

    // 如果胜方超过21分，负方必须至少20分（平分后连得2分）
    if (maxScore > 21 && minScore < 20) return false;

    return true;
  },

  /** 更新比分（只修改分数，不自动结束） */
  updateScore(team: 'A' | 'B', delta: number) {
    const idx = this.data.currentCourt;
    const matches = [...this.data.matches];
    const match = { ...matches[idx] };

    if (match.status === 'finished') return;

    if (team === 'A') {
      match.scoreA = Math.max(0, match.scoreA + delta);
    } else {
      match.scoreB = Math.max(0, match.scoreB + delta);
    }

    match.status = 'playing';
    matches[idx] = match;
    this.setData({ matches });
  },

  /** 快速比分预设（只赋值，不结束比赛，还可以修改） */
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

  /** 下一场 → 校验当前局比分，符合21分制则结束并跳转 */
  onNextCourt() {
    const idx = this.data.currentCourt;
    const match = this.data.matches[idx];

    // 未结束的场次才需要校验
    if (match.status !== 'finished') {
      if (match.scoreA === match.scoreB) {
        wx.showToast({ title: '比分相同，无法结束', icon: 'none' });
        return;
      }
      // 校验是否符合21分制
      if (!this.isValidFinalScore(match.scoreA, match.scoreB)) {
        wx.showToast({ title: '比分不符合21分制规则（需≥21分且领先2分）', icon: 'none' });
        return;
      }
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
      mode: (app.globalData.currentGame as GameData)?.mode || 'free_cannon'
    };

    wx.redirectTo({ url: '/pages/cannon/result/result' });
  },

});
