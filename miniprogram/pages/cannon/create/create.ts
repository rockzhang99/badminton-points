// pages/cannon/create/create.ts
import { PlayModeConfig, PlayMode } from '../../../types/index';
import { PLAY_MODES } from '../../../utils/play-modes';

/** 临时选手（建局时使用，非数据库Member） */
interface Player {
  id: string;
  nickname: string;
}

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

    // 选手（本地临时数据，非炮库）
    players: [] as Player[],
    nextPlayerId: 1,

    // 报名导入弹窗
    showImportModal: false,
    importText: '',

    // 统计
    matchCountPerPlayer: 0,
    totalMatches: 0,

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
      // 预先创建最少人数的空输入框
      this.initPlayers(config.minPlayers);
    }

    // 生成默认比赛名
    const today = this.formatDate(new Date());
    this.setData({ gameName: `炮哥${today}局` });

    // 一键重新开炮
    if (replay) {
      this.setData({ isReplay: true, replayGameId: replay });
      this.loadReplayGame(replay);
    }
  },

  /** 初始化选手输入框 */
  initPlayers(count: number) {
    const players: Player[] = [];
    for (let i = 0; i < count; i++) {
      players.push({ id: `p_${i}_${Date.now()}`, nickname: '' });
    }
    this.setData({ players, nextPlayerId: count });
    this.checkCanStart();
  },

  /** 格式化日期 */
  formatDate(date: Date): string {
    return `${date.getMonth() + 1}${date.getDate().toString().padStart(2, '0')}`;
  },

  /** 输入选手昵称 */
  onPlayerInput(e: any) {
    const idx = e.currentTarget.dataset.index;
    const nickname = e.detail.value.trim();
    const key = `players[${idx}].nickname`;
    this.setData({ [key]: nickname });
    this.checkCanStart();
  },

  /** 添加一个选手输入框 */
  onAddPlayer() {
    const config = this.data.playModeConfig;
    if (!config || this.data.players.length >= config.maxPlayers) {
      wx.showToast({ title: `最多${config?.maxPlayers}人`, icon: 'none' });
      return;
    }
    const newPlayer: Player = { id: `p_${this.data.nextPlayerId}_${Date.now()}`, nickname: '' };
    this.setData({
      players: [...this.data.players, newPlayer],
      nextPlayerId: this.data.nextPlayerId + 1
    });
    this.checkCanStart();
  },

  /** 移除选手 */
  onRemovePlayer(e: any) {
    const idx = e.currentTarget.dataset.index;
    const config = this.data.playModeConfig;
    if (!config || this.data.players.length <= config.minPlayers) {
      wx.showToast({ title: `至少需要${config?.minPlayers}人`, icon: 'none' });
      return;
    }
    const players = [...this.data.players];
    players.splice(idx, 1);
    this.setData({ players });
    this.checkCanStart();
  },

  /** 显示导入弹窗 */
  onShowImportModal() {
    this.setData({ showImportModal: true, importText: '' });
  },

  /** 隐藏导入弹窗 */
  onHideImportModal() {
    this.setData({ showImportModal: false });
  },

  /** 粘贴剪贴板 */
  async onPasteClipboard() {
    try {
      const res = await wx.getClipboardData();
      this.setData({ importText: res.data });
    } catch {
      wx.showToast({ title: '粘贴失败', icon: 'none' });
    }
  },

  /** 清空导入文本 */
  onClearImportText() {
    this.setData({ importText: '' });
  },

  /** 导入文本变化 */
  onImportTextInput(e: any) {
    this.setData({ importText: e.detail.value });
  },

  /** 解析报名文本，提取名字列表 */
  parseSignupNames(text: string): string[] {
    const names: string[] = [];
    if (!text.trim()) return names;

    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 匹配常见报名格式：
      // 1. "1.【3.0】FEI 🍃" → 提取 FEI
      // 2. "1. FEI" → 提取 FEI
      // 3. "1、FEI" → 提取 FEI
      // 4. "【3.0】FEI" → 提取 FEI
      let name = '';

      // 格式1: 数字+.【等级】名字 或 数字+.名字 或 数字+、名字
      const match1 = trimmed.match(/^(?:\d+[\.、]\s*)?(?:【[^】]*】)?(.+?)\s*(?:[🍃⭐🔥💪🏸]|[a-zA-Z])?\s*$/);
      if (match1 && match1[1]) {
        name = match1[1].trim();
        // 清理常见的emoji和多余字符
        name = name.replace(/[🍃⭐🔥💪🏸✅✔️➕➖➕➖]/g, '').trim();
      }

      // 格式2: 纯中文名/英文名（无序号前缀）
      if (!name || name.length > 20) {
        const match2 = trimmed.match(/^[\s]*(.{2,10})[\s]*$/);
        if (match2) name = match2[1].trim();
      }

      if (name && name.length >= 1 && name.length <= 15 && !/^[\d\s]+$/.test(name)) {
        names.push(name);
      }
    }

    return names;
  },

  /** 从报名导入选手 */
  onImportPlayers() {
    const text = this.data.importText.trim();
    if (!text) {
      wx.showToast({ title: '请先粘贴报名信息', icon: 'none' });
      return;
    }

    const names = this.parseSignupNames(text);
    if (names.length === 0) {
      wx.showToast({ title: '未能识别出有效昵称', icon: 'none' });
      return;
    }

    const config = this.data.playModeConfig;
    if (!config) return;

    const currentPlayers = this.data.players.filter(p => p.nickname);
    const currentNames = new Set(currentPlayers.map(p => p.nickname));
    const maxCanAdd = config.maxPlayers - currentPlayers.length;
    let added = 0;

    const newPlayers: Player[] = [];
    for (const name of names) {
      if (added >= maxCanAdd) break;
      if (currentNames.has(name)) continue; // 去重
      newPlayers.push({ id: `p_import_${this.data.nextPlayerId++}_${Date.now()}`, nickname: name });
      currentNames.add(name);
      added++;
    }

    if (newPlayers.length === 0) {
      wx.showToast({ title: '没有新选手可添加（可能已存在或已满）', icon: 'none' });
      return;
    }

    // 将新选手追加到现有列表末尾，同时保留空输入框用于手动补充
    this.setData({
      players: [...this.data.players, ...newPlayers],
      showImportModal: false,
      importText: ''
    });

    wx.showToast({ title: `成功导入${added}位选手`, icon: 'success' });
    this.checkCanStart();
  },

  /** 确认添加 — 填充空位模式（先填空白输入框，再追加） */
  onConfirmImport() {
    const text = this.data.importText.trim();
    if (!text) {
      wx.showToast({ title: '请先粘贴报名信息', icon: 'none' });
      return;
    }

    const names = this.parseSignupNames(text);
    if (names.length === 0) {
      wx.showToast({ title: '未能识别出有效昵称', icon: 'none' });
      return;
    }

    const config = this.data.playModeConfig;
    if (!config) return;

    const players = [...this.data.players];
    const currentNames = new Set(players.map(p => p.nickname).filter(Boolean));
    const maxCanAdd = config.maxPlayers - players.filter(p => p.nickname).length;
    
    let nameIdx = 0;
    let added = 0;

    // 第一步：填入空的输入框
    for (let i = 0; i < players.length && nameIdx < names.length && added < maxCanAdd; i++) {
      if (!players[i].nickname.trim() && !currentNames.has(names[nameIdx])) {
        players[i].nickname = names[nameIdx];
        currentNames.add(names[nameIdx]);
        nameIdx++;
        added++;
      }
    }

    // 第二步：剩余名字追加到末尾
    const appendList: Player[] = [];
    while (nameIdx < names.length && added < maxCanAdd) {
      appendList.push({
        id: `p_confirm_${this.data.nextPlayerId++}_${Date.now()}`,
        nickname: names[nameIdx]
      });
      nameIdx++;
      added++;
    }

    if (added === 0) {
      wx.showToast({ title: '没有新选手可添加', icon: 'none' });
      return;
    }

    this.setData({
      players: [...players, ...appendList],
      showImportModal: false,
      importText: ''
    });

    wx.showToast({ title: `成功导入${added}位选手`, icon: 'success' });
    this.checkCanStart();
  },

  /** 加载重赛的比赛数据 */
  loadReplayGame(gameId: string) {
    const db = wx.cloud.database();
    db.collection('games').doc(gameId).get().then((res: any) => {
      const game = res.data as any;
      this.setData({
        cannonWeight: game.cannonWeight,
        gameName: `${game.name}（复刻）`
      });
      // 重赛时恢复选手名称（从game的playerDetails或players字段）
      if (game.playerDetails && Array.isArray(game.playerDetails)) {
        const players = game.playerDetails.map((p: any, i: number) => ({
          id: `replay_${i}`,
          nickname: p.nickname || ''
        }));
        this.setData({ players });
        this.checkCanStart();
      }
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

  /** 检查是否可以开始 */
  checkCanStart() {
    const config = this.data.playModeConfig;
    const players = this.data.players;
    // 有足够数量且都有昵称才算可开始
    const validCount = players.filter(p => p.nickname.trim()).length;
    const canStart = config
      ? (validCount >= config.minPlayers && validCount <= config.maxPlayers)
      : false;

    // 计算比赛场数统计
    let matchCountPerPlayer = 0;
    let totalMatches = 0;
    if (canStart && config) {
      const n = validCount;
      switch (true) {
        case n <= 2: matchCountPerPlayer = 1; break;
        case n <= 4: matchCountPerPlayer = 3; break;
        case n <= 6: matchCountPerPlayer = 4; break;
        default: matchCountPerPlayer = n - 1; break;
      }
      totalMatches = Math.floor((n * matchCountPerPlayer) / 2);
    }

    this.setData({ canStart, matchCountPerPlayer, totalMatches });
  },

  /** 开炮！创建比赛并跳转对阵页 */
  onFire() {
    if (!this.data.canStart || !this.data.gameName.trim()) {
      wx.showToast({ title: '请完善比赛信息', icon: 'none' });
      return;
    }

    const validPlayers = this.data.players
      .filter(p => p.nickname.trim())
      .map(p => ({ id: p.id, nickname: p.nickname.trim() }));

    // 把选手信息编码为JSON传到对阵页
    const playerData = encodeURIComponent(JSON.stringify(validPlayers));
    const query = `mode=${this.data.playMode}&name=${encodeURIComponent(this.data.gameName)}&weight=${this.data.cannonWeight}&players=${playerData}&sound=${this.data.soundEnabled ? 1 : 0}`;

    wx.navigateTo({
      url: `/pages/cannon/match/match?${query}`
    });
  }
});
