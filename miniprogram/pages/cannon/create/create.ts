// pages/cannon/create/create.ts
import { PlayModeConfig, PlayMode } from '../../../types/index';
import { PLAY_MODES } from '../../../utils/play-modes';

/** 临时选手（建局时使用，非数据库Member） */
interface Player {
  id: string;
  nickname: string;
  gender: number; // 1=男 2=女
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
      players.push({ id: `p_${i}_${Date.now()}`, nickname: '', gender: 1 });
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

  /** 切换选手性别 */
  onGenderToggle(e: any) {
    const idx = e.currentTarget.dataset.index;
    const player = this.data.players[idx];
    if (!player) return;
    const newGender = player.gender === 1 ? 2 : 1; // 1=男 ↔ 2=女
    this.setData({ [`players[${idx}].gender`]: newGender });
  },

  /** 添加一个选手输入框 */
  onAddPlayer() {
    const config = this.data.playModeConfig;
    if (!config || this.data.players.length >= config.maxPlayers) {
      wx.showToast({ title: `最多${config?.maxPlayers}人`, icon: 'none' });
      return;
    }
    const newPlayer: Player = { id: `p_${this.data.nextPlayerId}_${Date.now()}`, nickname: '', gender: 1 };
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

    // 排除词：明显不是人名的内容
    const stopWords = new Set([
      '待进行', '已完成', '进行中', '已结束', '已开始',
      '第', '轮', '场', 'VS', 'vs', '队', '局',
      '羽毛球', '工具', '报名', '名单', '接龙', '闪动',
      '取消', '确认', '提交', '删除', '添加', '修改',
      '请输入', '选手', '昵称', ' placeholder', '输入框'
    ]);

    // 排除模式：包含这些关键词的行直接跳过
    const stopPatterns = [
      /请输入.*昵称/, /placeholder/, /输入选手/,
      /待进行|已完成|已结束/, /^第?\d*\s*场/,
      /^\d+[\.\s]*VS/, /^--+$/
    ];

    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 2) continue;

      // 先用排除模式过滤整行
      let skipped = false;
      for (const pat of stopPatterns) {
        if (pat.test(trimmed)) { skipped = true; break; }
      }
      if (skipped) continue;

      // 排除词检查（整行或关键部分）
      if (stopWords.has(trimmed)) continue;

      let name = '';

      // 格式A: 序号前缀 + 【等级】+ 名字（如 "16.【3.5】燚燚的雪" 或 "18. 李素" 或 "3、张三"）
      const matchA = trimmed.match(
        /^\s*\d+\s*[\.\.、:：]\s*(?:【[^】]{1,8}】)?\s*([a-zA-Z\u4e00-\u9fa5]{1,10}(?:\s*[a-zA-Z\u4e00-\u9fa5]*){0,4})/
      );
      if (matchA && matchA[1]) {
        name = matchA[1].trim();
      }

      // 格式B: 纯中文名（2-6字）——严格条件：不含任何数字、符号、英文混合
      if (!name) {
        if (!/\d/.test(trimmed) && !/[【】\[\]（）()·•\-—_]/.test(trimmed)) {
          const matchB = trimmed.match(/^([a-zA-Z\u4e00-\u9fa5]{2,8})$/);
          if (matchB) {
            name = matchB[1].trim();
          }
        }
      }

      // 最终校验
      if (!name) continue;
      name = name.replace(/[🍃⭐🔥💪🏸✅✔️➕➖⚡️]/g, '').trim();

      // 长度过滤：名字至少2个字符（单字太容易误匹配）
      if (name.length < 2 || name.length > 12) continue;

      // 排除词过滤
      if (stopWords.has(name)) continue;

      // 不能纯数字
      if (/^\d+$/.test(name)) continue;

      // 不能是常见无意义短词
      if (/^[的是有了在和他这那我你她它就都也而]$/.test(name)) continue;

      names.push(name);
    }

    return names;
  },

  /** 从报名导入选手（顺序添加：先填空位，再追加） */
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

    const players = [...this.data.players];
    
    // 关键修复：用总槽位数（含空位）来算上限，不是只算有名字的
    const existingValidCount = players.filter(p => p.nickname.trim()).length;
    const maxCanAdd = config.maxPlayers - existingValidCount;

    if (maxCanAdd <= 0) {
      wx.showToast({ title: `已达${config.maxPlayers}人上限`, icon: 'none' });
      return;
    }

    const currentNamesSet = new Set(players.map(p => p.nickname).filter(Boolean));
    let nameIdx = 0;
    let added = 0;

    // 第一步：优先填入空槽位（1-8的空输入框）
    for (let i = 0; i < players.length && nameIdx < names.length && added < maxCanAdd; i++) {
      if (!players[i].nickname.trim() && !currentNamesSet.has(names[nameIdx])) {
        players[i].nickname = names[nameIdx];
        currentNamesSet.add(names[nameIdx]);
        nameIdx++;
        added++;
      }
    }

    // 第二步：剩余名字追加到末尾
    const appendList: Player[] = [];
    while (nameIdx < names.length && added < maxCanAdd) {
      if (!currentNamesSet.has(names[nameIdx])) {
        appendList.push({
          id: `p_import_${this.data.nextPlayerId++}_${Date.now()}`,
          nickname: names[nameIdx],
          gender: 1
        });
        currentNamesSet.add(names[nameIdx]);
        added++;
      }
      nameIdx++;
    }

    if (added === 0) {
      wx.showToast({ title: '没有新选手可添加', icon: 'none' });
      return;
    }

    // 最终总数校验
    const finalTotal = existingValidCount + added;
    if (finalTotal > config.maxPlayers) {
      wx.showToast({ title: `最多只能有${config.maxPlayers}位选手`, icon: 'none' });
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
    const currentNamesSet = new Set(players.map(p => p.nickname).filter(Boolean));
    
    // 严格上限：已有非空选手数 + 可添加数 ≤ maxPlayers
    const existingValidCount = players.filter(p => p.nickname.trim()).length;
    const maxCanAdd = config.maxPlayers - existingValidCount;

    if (maxCanAdd <= 0) {
      wx.showToast({ title: `已达${config.maxPlayers}人上限`, icon: 'none' });
      return;
    }
    
    let nameIdx = 0;
    let added = 0;

    // 第一步：填入空的输入框
    for (let i = 0; i < players.length && nameIdx < names.length && added < maxCanAdd; i++) {
      if (!players[i].nickname.trim() && !currentNamesSet.has(names[nameIdx])) {
        players[i].nickname = names[nameIdx];
        currentNamesSet.add(names[nameIdx]);
        nameIdx++;
        added++;
      }
    }

    // 第二步：剩余名字追加到末尾（不超过总上限）
    const appendList: Player[] = [];
    while (nameIdx < names.length && added < maxCanAdd) {
      if (!currentNamesSet.has(names[nameIdx])) {
        appendList.push({
          id: `p_confirm_${this.data.nextPlayerId++}_${Date.now()}`,
          nickname: names[nameIdx],
          gender: 1
        });
        currentNamesSet.add(names[nameIdx]);
        added++;
      }
      nameIdx++;
    }

    if (added === 0) {
      wx.showToast({ title: '没有新选手可添加', icon: 'none' });
      return;
    }

    // 最终总人数校验：确保不超过 maxPlayers
    const finalTotal = players.filter(p => p.nickname.trim()).length + appendList.length;
    if (finalTotal > config.maxPlayers) {
      wx.showToast({ title: `最多只能有${config.maxPlayers}位选手`, icon: 'none' });
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
          nickname: p.nickname || '',
          gender: p.gender || 1
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
      .map(p => ({ id: p.id, nickname: p.nickname.trim(), gender: p.gender }));

    // 把选手信息编码为JSON传到对阵页
    const playerData = encodeURIComponent(JSON.stringify(validPlayers));
    const query = `mode=${this.data.playMode}&name=${encodeURIComponent(this.data.gameName)}&weight=${this.data.cannonWeight}&players=${playerData}&sound=${this.data.soundEnabled ? 1 : 0}`;

    wx.navigateTo({
      url: `/pages/cannon/match/match?${query}`
    });
  }
});
