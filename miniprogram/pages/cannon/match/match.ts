// pages/cannon/match/match.ts
import { PlayMode, Match } from '../../../types/index';
import { generateMatches, getMatchPreview } from '../../../utils/match-engine';

Page({
  data: {
    mode: '' as PlayMode,
    gameName: '',
    cannonWeight: 1.0,
    playerIds: [] as string[],
    members: [] as any[],
    matches: [] as Match[],
    preview: { totalRounds: 0, totalMatches: 0, matchesPerPlayer: 0 },
    soundEnabled: true
  },

  onLoad(options: any) {
    const mode = options.mode as PlayMode;
    const name = decodeURIComponent(options.name || '');
    const weight = parseFloat(options.weight) || 1.0;
    const players = (options.players || '').split(',').filter(Boolean);
    const sound = options.sound === '1';

    this.setData({
      mode, gameName: name, cannonWeight: weight,
      playerIds: players, soundEnabled: sound
    });

    this.loadMemberInfo(players);
    this.generateMatches(mode, players);
  },

  /** 加载队员详情 */
  loadMemberInfo(ids: string[]) {
    const db = wx.cloud.database();
    db.collection('members')
      .where({ _id: db.command.in(ids) })
      .get()
      .then(res => {
        this.setData({ members: res.data });
      })
      .catch(() => {
        // 离线模式
        const cached = wx.getStorageSync('members') || [];
        const filtered = cached.filter((m: any) => ids.includes(m._id));
        this.setData({ members: filtered });
      });
  },

  /** 生成对阵 */
  generateMatches(mode: PlayMode, playerIds: string[]) {
    const matches = generateMatches(mode, playerIds);
    const preview = getMatchPreview(mode, playerIds.length);

    this.setData({ matches, preview });
  },

  /** 重新生成对阵 */
  onReshuffle() {
    this.generateMatches(this.data.mode, this.data.playerIds);
    wx.showToast({ title: '已重新生成对阵', icon: 'success' });
  },

  /** 获取队员昵称 */
  getMemberName(memberId: string): string {
    const member = this.data.members.find(m => m._id === memberId);
    return member?.nickname || memberId.slice(0, 6);
  },

  /** 获取队员头像 */
  getMemberAvatar(memberId: string): string {
    const member = this.data.members.find(m => m._id === memberId);
    return member?.avatarUrl || '';
  },

  /** 进入记分页 */
  onStartGame() {
    const gameData = {
      mode: this.data.mode,
      name: this.data.gameName,
      cannonWeight: this.data.cannonWeight,
      matches: this.data.matches,
      players: this.data.playerIds,
      members: this.data.members,
      soundEnabled: this.data.soundEnabled
    };

    // 存储到全局数据
    const app = getApp<IAppOption>();
    app.globalData.currentGame = gameData;

    wx.redirectTo({
      url: '/pages/cannon/scoring/scoring'
    });
  }
});
