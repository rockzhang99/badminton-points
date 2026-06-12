// pages/cannon/scoring/scoring.ts
import { Match, CannnonEvent } from '../../../types/index';
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
    showCannonPanel: false,
    cannonFromMember: '',   // 谁在开炮

    // 进度
    finishedCount: 0,
    totalCount: 0,
    progress: 0
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
      cannonEvents: m.cannonEvents || []
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
  },

  /** 切换场地（swiper change） */
  onCourtChange(e: any) {
    this.setData({ currentCourt: e.detail.current });
  },

  /** 获取队员昵称 */
  getMemberName(id: string): string {
    const m = this.data.members.find((x: any) => x._id === id);
    return m?.nickname || id.slice(0, 6);
  },

  /** A队 +1 */
  onAddA() {
    this.updateScore('A', 1);
  },

  /** A队 -1 */
  onMinusA() {
    this.updateScore('A', -1);
  },

  /** B队 +1 */
  onAddB() {
    this.updateScore('B', 1);
  },

  /** B队 -1 */
  onMinusB() {
    this.updateScore('B', -1);
  },

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

  /** 本局结束 */
  onFinishMatch() {
    const idx = this.data.currentCourt;
    const matches = [...this.data.matches];
    const match = { ...matches[idx] };

    if (match.scoreA === match.scoreB) {
      wx.showToast({ title: '比分不能平局', icon: 'none' });
      return;
    }

    match.winner = match.scoreA > match.scoreB ? 'A' : 'B';
    // 标记完成前，已有炮击事件 — 炮击已记录在 match.cannonEvents 中
    match.status = 'finished';
    matches[idx] = match;
    this.setData({ matches });

    this.updateProgress();

    wx.showToast({ title: `${match.winner === 'A' ? 'A队' : 'B队'} 获胜！`, icon: 'success' });
  },

  /** 显示开炮面板 */
  onShowCannon() {
    const idx = this.data.currentCourt;
    const match = this.data.matches[idx];
    if (match.status === 'finished') {
      wx.showToast({ title: '本局已结束，不能再开炮', icon: 'none' });
      return;
    }

    // 判断谁是胜方（当前领先者）
    const winningTeam = match.scoreA > match.scoreB ? 'A' : match.scoreB > match.scoreA ? 'B' : '';
    if (!winningTeam) {
      wx.showToast({ title: '先打出分差再来开炮吧', icon: 'none' });
      return;
    }

    // 从胜方选 MVP：暂时选中胜方首个队员
    const candidates = winningTeam === 'A' ? match.teamA : match.teamB;

    this.setData({
      showCannonPanel: true,
      cannonFromMember: candidates[0],
      _cannonTargets: (winningTeam === 'A' ? match.teamB : match.teamA),
      _currentMatchIdx: idx
    });
  },

  /** 关闭开炮面板 */
  onCloseCannon() {
    this.setData({ showCannonPanel: false });
  },

  /** 选中被炮者 */
  onSelectTarget(e: any) {
    const targetId = e.currentTarget.dataset.id;
    const idx = this.data._currentMatchIdx as number;
    const matches = [...this.data.matches];
    const match = { ...matches[idx] };

    const event: CannonEvent = {
      from: this.data.cannonFromMember,
      to: targetId
    };

    match.cannonEvents = [...match.cannonEvents, event];
    matches[idx] = match;
    this.setData({ matches, showCannonPanel: false });

    // 炮声反馈
    if (this.data.soundEnabled) {
      const audio = wx.createInnerAudioContext();
      audio.src = '/static/audio/cannon-fire.mp3';
      audio.play();
    }

    const targetName = this.getMemberName(targetId);
    const fromName = this.getMemberName(this.data.cannonFromMember);
    wx.showToast({
      title: `${targetName} 挨了 ${fromName} 一炮！`,
      icon: 'none',
      duration: 2000
    });
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

  /** 阻止冒泡 */
  noop() {}
});
