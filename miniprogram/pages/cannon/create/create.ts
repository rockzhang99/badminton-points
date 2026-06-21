// pages/cannon/create/create.ts
import { PlayModeConfig, PlayMode, PartnerPair } from '../../../types/index';
import { PLAY_MODES } from '../../../utils/play-modes';
import { getMatchPreview } from '../../../utils/match-engine';

/** 临时选手（建局时使用，非数据库Member） */
interface Player {
  id: string;
  nickname: string;
  gender: number; // 1=男 2=女
}

/** 固定搭模式下，一对搭档 */
interface PartnerPairData {
  id: string;
  player1: Player;
  player2: Player;
}

Page({
  data: {
    // 玩法
    playMode: 'cannon_rotation_8' as PlayMode,
    playModeConfig: null as PlayModeConfig | null,

    // 表单
    gameName: '',

    // 选手（普通模式：个人输入）
    players: [] as Player[],
    nextPlayerId: 1,

    // 固定搭模式：搭档输入
    pairs: [] as PartnerPairData[],
    nextPairId: 1,

    // 报名导入弹窗
    showImportModal: false,
    importText: '',

    // 统计
    matchCountPerPlayer: 0,
    totalMatches: 0,

    // 搭档统计（固定搭模式）
    pairCount: 0,
    expectedMatches: 0,

    // 玩法说明
    playModeRules: [] as string[],

    // 状态
    isReplay: false,
    replayGameId: '',
    canStart: false,

    // 是否为固定搭模式（计算属性）
    isPartnerMode: false
  },

  onLoad(options: any) {
    const mode = options.mode as PlayMode;
    const replay = options.replay;

    // 设置玩法
    const config = PLAY_MODES.find(m => m.mode === mode);
    if (config) {
      this.setData({ playMode: mode, playModeConfig: config, isPartnerMode: mode === 'blind_cannon' });
      if (mode === 'blind_cannon') {
        // 固定搭模式：初始化 3 对
        this.initPairs(3);
      } else {
        // 普通模式：初始化最少人数的空输入框
        this.initPlayers(config.minPlayers);
      }
      // 生成玩法说明
      this.buildPlayModeRules(mode);
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

  /** 初始化选手输入框（普通模式） */
  initPlayers(count: number) {
    const players: Player[] = [];
    for (let i = 0; i < count; i++) {
      players.push({ id: `p_${i}_${Date.now()}`, nickname: '', gender: 1 });
    }
    this.setData({ players, nextPlayerId: count });
    this.checkCanStart();
  },

  /** 初始化搭档对（固定搭模式） */
  initPairs(count: number) {
    const pairs: PartnerPairData[] = [];
    for (let i = 0; i < count; i++) {
      pairs.push(this.createEmptyPair(i));
    }
    this.setData({ pairs, nextPairId: count });
    this.checkCanStart();
  },

  /** 创建一对空搭档 */
  createEmptyPair(index: number): PartnerPairData {
    const baseId = `pair_${Date.now()}_${index}`;
    return {
      id: baseId,
      player1: { id: `${baseId}_p1`, nickname: '', gender: 1 },
      player2: { id: `${baseId}_p2`, nickname: '', gender: 1 }
    };
  },

  /** 格式化日期 */
  formatDate(date: Date): string {
    return `${date.getMonth() + 1}${date.getDate().toString().padStart(2, '0')}`;
  },

  /** 输入选手昵称（普通模式） */
  onPlayerInput(e: any) {
    const idx = e.currentTarget.dataset.index;
    const nickname = e.detail.value.trim();
    const key = `players[${idx}].nickname`;
    this.setData({ [key]: nickname });
    this.checkCanStart();
  },

  /** 切换选手性别（普通模式） */
  onGenderToggle(e: any) {
    const idx = e.currentTarget.dataset.index;
    const player = this.data.players[idx];
    if (!player) return;
    const newGender = player.gender === 1 ? 2 : 1;
    this.setData({ [`players[${idx}].gender`]: newGender });
  },

  /** 输入搭档昵称（固定搭模式） */
  onPairInput(e: any) {
    const pairIdx = e.currentTarget.dataset.pairIndex;
    const playerKey = e.currentTarget.dataset.playerKey as string; // 'player1' or 'player2'
    const nickname = e.detail.value.trim();
    this.setData({ [`pairs[${pairIdx}].${playerKey}.nickname`]: nickname });
    this.checkCanStart();
  },

  /** 切换搭档性别（固定搭模式） */
  onPairGenderToggle(e: any) {
    const pairIdx = e.currentTarget.dataset.pairIndex;
    const playerKey = e.currentTarget.dataset.playerKey as string;
    const player = this.data.pairs[pairIdx]?.[playerKey];
    if (!player) return;
    const newGender = player.gender === 1 ? 2 : 1;
    this.setData({ [`pairs[${pairIdx}].${playerKey}.gender`]: newGender });
  },

  /** 添加一个选手输入框（普通模式） */
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

  /** 移除选手（普通模式） */
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

  /** 添加一对搭档（固定搭模式） */
  onAddPair() {
    const config = this.data.playModeConfig;
    if (!config) return;
    const pairCount = this.data.pairs.length;
    if (pairCount >= 6) {
      wx.showToast({ title: '最多 6 对搭档', icon: 'none' });
      return;
    }
    const newPair = this.createEmptyPair(this.data.nextPairId);
    this.setData({
      pairs: [...this.data.pairs, newPair],
      nextPairId: this.data.nextPairId + 1
    });
    this.checkCanStart();
  },

  /** 移除一对搭档（固定搭模式） */
  onRemovePair(e: any) {
    const idx = e.currentTarget.dataset.index;
    const pairCount = this.data.pairs.length;
    if (pairCount <= 3) {
      wx.showToast({ title: '至少需要 3 对搭档', icon: 'none' });
      return;
    }
    const pairs = [...this.data.pairs];
    pairs.splice(idx, 1);
    this.setData({ pairs });
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

    const stopWords = new Set([
      '待进行', '已完成', '进行中', '已结束', '已开始',
      '第', '轮', '场', 'VS', 'vs', '队', '局',
      '羽毛球', '工具', '报名', '名单', '接龙', '闪动',
      '取消', '确认', '提交', '删除', '添加', '修改',
      '请输入', '选手', '昵称', ' placeholder', '输入框'
    ]);

    const stopPatterns = [
      /请输入.*昵称/, /placeholder/, /输入选手/,
      /待进行|已完成|已结束/, /^第?\d*\s*场/,
      /^\d+[\.\s]*VS/, /^--+$/
    ];

    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 2) continue;

      let skipped = false;
      for (const pat of stopPatterns) {
        if (pat.test(trimmed)) { skipped = true; break; }
      }
      if (skipped) continue;

      if (stopWords.has(trimmed)) continue;

      let name = '';

      const matchA = trimmed.match(
        /^\s*\d+\s*[\.\.、:：]\s*(?:【[^】]{1,8}】)?\s*([a-zA-Z一-龥]{1,10}(?:\s*[a-zA-Z一-龥]*){0,4})/
      );
      if (matchA && matchA[1]) {
        name = matchA[1].trim();
      }

      if (!name) {
        if (!/\d/.test(trimmed) && !/[【】\[\]（）()·•\-—_]/.test(trimmed)) {
          const matchB = trimmed.match(/^([a-zA-Z一-龥]{2,8})$/);
          if (matchB) {
            name = matchB[1].trim();
          }
        }
      }

      if (!name) continue;
      name = name.replace(/[🍃⭐🔥💪🏸✅✔️➕➖⚡️]/g, '').trim();

      if (name.length < 2 || name.length > 12) continue;
      if (stopWords.has(name)) continue;
      if (/^\d+$/.test(name)) continue;
      if (/^[的是有了在和他这那我你她它就都也而]$/.test(name)) continue;

      names.push(name);
    }

    return names;
  },

  /** 导入选手（普通模式） */
  onImportPlayers() {
    if (this.data.isPartnerMode) {
      this.importToPairs();
    } else {
      this.importToPlayers();
    }
  },

  /** 导入选手到普通模式 */
  importToPlayers() {
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
    const existingValidCount = players.filter(p => p.nickname.trim()).length;
    const maxCanAdd = config.maxPlayers - existingValidCount;

    if (maxCanAdd <= 0) {
      wx.showToast({ title: `已达${config.maxPlayers}人上限`, icon: 'none' });
      return;
    }

    const currentNamesSet = new Set(players.map(p => p.nickname).filter(Boolean));
    let nameIdx = 0;
    let added = 0;

    for (let i = 0; i < players.length && nameIdx < names.length && added < maxCanAdd; i++) {
      if (!players[i].nickname.trim() && !currentNamesSet.has(names[nameIdx])) {
        players[i].nickname = names[nameIdx];
        currentNamesSet.add(names[nameIdx]);
        nameIdx++;
        added++;
      }
    }

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

  /** 导入选手到固定搭模式 — 按名字顺序两两配对 */
  importToPairs() {
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

    if (names.length < 6) {
      wx.showToast({ title: `至少需要6位选手（3对），当前识别${names.length}位`, icon: 'none' });
      return;
    }

    if (names.length > 12) {
      wx.showToast({ title: `最多12位选手（6对），当前${names.length}位超出`, icon: 'none' });
      return;
    }

    // 两两配对
    const pairs: PartnerPairData[] = [];
    for (let i = 0; i < names.length; i += 2) {
      const pairId = `pair_import_${i / 2}_${Date.now()}`;
      if (i + 1 >= names.length) break; // 奇数人数忽略最后一人
      pairs.push({
        id: pairId,
        player1: { id: `${pairId}_p1`, nickname: names[i], gender: 1 },
        player2: { id: `${pairId}_p2`, nickname: names[i + 1], gender: 1 }
      });
    }

    this.setData({
      pairs,
      nextPairId: pairs.length,
      showImportModal: false,
      importText: ''
    });

    wx.showToast({ title: `成功导入${pairs.length}对搭档`, icon: 'success' });
    this.checkCanStart();
  },

  /** 确认添加（兼容旧逻辑） */
  onConfirmImport() {
    this.onImportPlayers();
  },

  /** 加载重赛的比赛数据 */
  loadReplayGame(gameId: string) {
    const db = wx.cloud.database();
    db.collection('games').doc(gameId).get().then((res: any) => {
      const game = res.data as any;
      this.setData({
        gameName: `${game.name}（复刻）`
      });
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

  /** 生成玩法说明 */
  buildPlayModeRules(mode: PlayMode) {
    const rules: string[] = [];
    switch (mode) {
      case 'cannon_rotation_8':
        rules.push('每人与其他选手各搭档1次');
        rules.push('5人：每人4场，共5场');
        rules.push('6人：每人4场，共6场');
        rules.push('7人：每人8场，共14场');
        rules.push('8人：每人7场，共14场');
        break;
      case 'blind_cannon':
        rules.push('固定搭档，3-6对循环对抗');
        rules.push('每对与其他各对交手1次');
        rules.push('胜方得2分，排名：积分 → 胜场 → 净胜分 → 总得分');
        break;
      default:
        break;
    }
    this.setData({ playModeRules: rules });
  },

  /** 检查是否可以开始 */
  checkCanStart() {
    const config = this.data.playModeConfig;
    if (!config) {
      this.setData({ canStart: false });
      return;
    }

    let canStart = false;
    let matchCountPerPlayer = 0;
    let totalMatches = 0;
    let pairCount = 0;
    let expectedMatches = 0;

    if (this.data.isPartnerMode) {
      // 固定搭模式：每对两人均需有昵称
      const pairs = this.data.pairs;
      pairCount = pairs.length;
      const allFilled = pairs.every(p =>
        p.player1.nickname.trim() && p.player2.nickname.trim()
      );
      const validCount = pairCount * 2;
      canStart = allFilled && pairCount >= 3 && pairCount <= 6;
      if (canStart) {
        const preview = getMatchPreview(this.data.playMode, validCount);
        matchCountPerPlayer = preview.matchesPerPlayer;
        totalMatches = preview.totalMatches;
        expectedMatches = preview.totalMatches;
      }
    } else {
      // 普通模式
      const players = this.data.players;
      const validCount = players.filter(p => p.nickname.trim()).length;
      canStart = validCount >= config.minPlayers && validCount <= config.maxPlayers;
      if (canStart) {
        const preview = getMatchPreview(this.data.playMode, validCount);
        matchCountPerPlayer = preview.matchesPerPlayer;
        totalMatches = preview.totalMatches;
      }
    }

    this.setData({ canStart, matchCountPerPlayer, totalMatches, pairCount, expectedMatches });
  },

  /** 开炮！创建比赛并跳转对阵页 */
  onFire() {
    if (!this.data.canStart || !this.data.gameName.trim()) {
      wx.showToast({ title: '请完善比赛信息', icon: 'none' });
      return;
    }

    let validPlayers: Player[];

    if (this.data.isPartnerMode) {
      // 固定搭模式：从 pairs 扁平化为 player 数组
      validPlayers = this.data.pairs.flatMap(p => [
        { id: p.player1.id, nickname: p.player1.nickname.trim(), gender: p.player1.gender },
        { id: p.player2.id, nickname: p.player2.nickname.trim(), gender: p.player2.gender }
      ]);
    } else {
      validPlayers = this.data.players
        .filter(p => p.nickname.trim())
        .map(p => ({ id: p.id, nickname: p.nickname.trim(), gender: p.gender }));
    }

    const playerData = encodeURIComponent(JSON.stringify(validPlayers));
    const query = `mode=${this.data.playMode}&name=${encodeURIComponent(this.data.gameName)}&players=${playerData}`;

    wx.navigateTo({
      url: `/pages/cannon/match/match?${query}`
    });
  }
});
