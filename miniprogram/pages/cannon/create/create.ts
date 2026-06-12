// pages/cannon/create/create.ts
import { PlayModeConfig, PlayMode, Game } from '../../../types/index';
import { PLAY_MODES } from '../../../utils/play-modes';

Page({
  data: {
    // 玩法
    playMode: 'cannon_rotation_8' as PlayMode,
    playModeConfig: null as PlayModeConfig | null,

    // 表单
    gameName: '',
    cannonWeight: 1.0,
    weaponValues: ['友谊赛 0.5', '常规局 1.0', '内战 1.5', '生死局 2.0'],
    cannonWeightIndex: 1,
    soundEnabled: true,

    // 队员
    members: [] as any[],
    selectedMembers: [] as string[],

    // 状态
    isReplay: false,
    replayGameId: '',
    canStart: false
  },

  onLoad(options: any) {
    const mode = options.mode as PlayMode;
    const replay = options.replay;

    // 设置玩法
    const config = PLAY_MODES.find(m => m.mode === mode);
    if (config) {
      this.setData({ playMode: mode, playModeConfig: config });
    }

    // 生成默认比赛名
    const today = this.formatDate(new Date());
    this.setData({ gameName: `炮哥${today}局` });

    // 一键重新开炮
    if (replay) {
      this.setData({ isReplay: true, replayGameId: replay });
      this.loadReplayGame(replay);
    }

    this.loadMembers();
  },

  onShow() {
    this.loadMembers();
  },

  /** 格式化日期 */
  formatDate(date: Date): string {
    return `${date.getMonth() + 1}${date.getDate().toString().padStart(2, '0')}`;
  },

  /** 加载队员列表 */
  loadMembers() {
    const db = wx.cloud.database();
    db.collection('members')
      .orderBy('createdAt', 'desc')
      .get()
      .then(res => {
        this.setData({ members: res.data });
      })
      .catch(() => {
        // 离线缓存
        const cached = wx.getStorageSync('members') || [];
        this.setData({ members: cached });
      });
  },

  /** 加载重赛的比赛数据 */
  loadReplayGame(gameId: string) {
    const db = wx.cloud.database();
    db.collection('games').doc(gameId).get().then((res: any) => {
      const game = res.data as Game;
      this.setData({
        playMode: game.playMode,
        cannonWeight: game.cannonWeight,
        selectedMembers: game.players,
        gameName: `${game.name}（复刻）`
      });
    }).catch(() => {});
  },

  /** 修改比赛名称 */
  onNameInput(e: any) {
    this.setData({ gameName: e.detail.value });
  },

  /** 调整炮重 */
  onCannonWeightChange(e: any) {
    const weights = [0.5, 1.0, 1.5, 2.0];
    this.setData({
      cannonWeightIndex: e.detail.value,
      cannonWeight: weights[e.detail.value]
    });
  },

  /** 切换炮声 */
  onSoundToggle(e: any) {
    this.setData({ soundEnabled: e.detail.value });
  },

  /** 选择队员 */
  onSelectMember(e: any) {
    const id = e.currentTarget.dataset.id;
    const selected = this.data.selectedMembers;
    const idx = selected.indexOf(id);

    if (idx > -1) {
      selected.splice(idx, 1);
    } else {
      const config = this.data.playModeConfig;
      if (config && selected.length >= config.maxPlayers) {
        wx.showToast({ title: `最多${config.maxPlayers}人`, icon: 'none' });
        return;
      }
      selected.push(id);
    }

    this.setData({ selectedMembers: [...selected] });
    this.checkCanStart();
  },

  /** 去添加队员 */
  onAddMember() {
    wx.navigateTo({ url: '/pages/arsenal/members/members' });
  },

  /** 检查是否可以开始 */
  checkCanStart() {
    const config = this.data.playModeConfig;
    const count = this.data.selectedMembers.length;
    const canStart = config ? (count >= config.minPlayers && count <= config.maxPlayers) : false;
    this.setData({ canStart });
  },

  /** 开炮！创建比赛并跳转对阵页 */
  onFire() {
    if (!this.data.canStart || !this.data.gameName) {
      wx.showToast({ title: '请完善比赛信息', icon: 'none' });
      return;
    }

    const params = {
      playMode: this.data.playMode,
      gameName: this.data.gameName,
      cannonWeight: this.data.cannonWeight,
      selectedMembers: this.data.selectedMembers,
      soundEnabled: this.data.soundEnabled
    };

    // 把参数编码后传到对阵页（避免建局页被销毁前存太多数据）
    const query = `mode=${params.playMode}&name=${encodeURIComponent(params.gameName)}&weight=${params.cannonWeight}&players=${params.selectedMembers.join(',')}&sound=${params.soundEnabled ? 1 : 0}`;
    wx.navigateTo({
      url: `/pages/cannon/match/match?${query}`
    });
  }
});
