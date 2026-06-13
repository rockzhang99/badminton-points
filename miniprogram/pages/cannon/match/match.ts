// pages/cannon/match/match.ts
import { PlayMode, Match } from '../../../types/index';
import { generateMatches, getMatchPreview } from '../../../utils/match-engine';

/** 建局时传入的临时选手数据 */
interface TempPlayer {
  id: string;
  nickname: string;
}

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
    const sound = options.sound === '1';

    // 解析选手数据：新格式为 JSON 编码的 {id, nickname}[] 数组
    let players: TempPlayer[] = [];
    let playerIds: string[] = [];
    try {
      players = JSON.parse(decodeURIComponent(options.players || '[]'));
      if (!Array.isArray(players)) players = [];
    } catch {
      // 兼容旧格式（逗号分隔的 ID 列表）
      const oldIds = (options.players || '').split(',').filter(Boolean);
      players = oldIds.map(id => ({ id, nickname: id.slice(0, 6) }));
    }

    playerIds = players.map(p => p.id);

    // 将临时选手数据转为兼容 members 格式 {_id, nickname}
    const members = players.map(p => ({
      _id: p.id,
      nickname: p.nickname,
      avatarUrl: ''
    }));

    this.setData({
      mode, gameName: name, cannonWeight: weight,
      playerIds, members, soundEnabled: sound
    });

    this.generateMatches(mode, playerIds);
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
