// pages/settlement/billing/billing.ts
import { calcBilling, exemptMember, BillingParams, BillingResult } from '../../../utils/billing';

Page({
  data: {
    gameId: '',
    game: null as any,

    // 费用输入
    courtFee: '',
    shuttle1Count: '',
    shuttle1Price: '',
    shuttle1Total: 0,
    shuttle2Count: '',
    shuttle2Price: '',
    shuttle2Total: 0,
    otherFee: '',

    // 女生优惠
    femaleMode: 'deduct' as 'deduct' | 'fixed',
    femaleDeductAmount: '5',
    femaleFixedAmount: '',

    // 计算结果
    result: null as BillingResult | null,
    memberDetails: [] as any[],
    cannonScores: {} as Record<string, number>,
    avgPerPerson: '0.00',
    billSaved: false
  },

  onLoad(options: any) {
    try {
      this.setData({ gameId: options?.gameId || '' });
      this.loadGame();
    } catch (e) {
      console.error('onLoad 出错:', e);
    }
  },

  async loadGame() {
    try {
      const cached = wx.getStorageSync('billingGameData');
      if (cached && cached.cannonScores && Object.keys(cached.cannonScores).length > 0) {
        this.setData({
          game: { ...cached, players: cached.players || [], playerDetails: cached.playerDetails || [] },
          cannonScores: cached.cannonScores
        });
        return;
      }

      const app = getApp<IAppOption>();
      const gd = app?.globalData?.currentGame as any;
      if (gd) {
        this.setData({
          game: gd,
          cannonScores: gd.cannonScores || {}
        });
        return;
      }

      if (this.data.gameId) {
        const db = wx.cloud.database();
        const res = await db.collection('games').doc(this.data.gameId).get();
        this.setData({
          game: res.data,
          cannonScores: (res.data as any)?.cannonScores || {}
        });
      }
    } catch (e) {
      console.error('loadGame 出错:', e);
    }
  },

  onCourtFeeInput(e: any) { this.setData({ courtFee: e.detail.value }); },
  onOtherFeeInput(e: any) { this.setData({ otherFee: e.detail.value }); },
  onFemaleModeChange(e: any) {
    this.setData({ femaleMode: e.currentTarget.dataset.mode });
  },
  onFemaleDeductInput(e: any) { this.setData({ femaleDeductAmount: e.detail.value }); },
  onFemaleFixedInput(e: any) { this.setData({ femaleFixedAmount: e.detail.value }); },

  onShuttle1CountInput(e: any) {
    const val = e.detail.value;
    const total = (parseFloat(val) || 0) * (parseFloat(this.data.shuttle1Price) || 0);
    this.setData({ shuttle1Count: val, shuttle1Total: Math.round(total * 100) / 100 });
  },

  onShuttle1PriceInput(e: any) {
    const val = e.detail.value;
    const total = (parseFloat(this.data.shuttle1Count) || 0) * (parseFloat(val) || 0);
    this.setData({ shuttle1Price: val, shuttle1Total: Math.round(total * 100) / 100 });
  },

  onShuttle2CountInput(e: any) {
    const val = e.detail.value;
    const total = (parseFloat(val) || 0) * (parseFloat(this.data.shuttle2Price) || 0);
    this.setData({ shuttle2Count: val, shuttle2Total: Math.round(total * 100) / 100 });
  },

  onShuttle2PriceInput(e: any) {
    const val = e.detail.value;
    const total = (parseFloat(this.data.shuttle2Count) || 0) * (parseFloat(val) || 0);
    this.setData({ shuttle2Price: val, shuttle2Total: Math.round(total * 100) / 100 });
  },

  onCalc() {
    const courtFee = parseFloat(this.data.courtFee) || 0;
    const shuttleFee = this.data.shuttle1Total + this.data.shuttle2Total;
    const otherFee = parseFloat(this.data.otherFee) || 0;

    if (courtFee + shuttleFee + otherFee === 0) {
      wx.showToast({ title: '请至少输入一项费用', icon: 'none' });
      return;
    }

    const game = this.data.game as any;
    const playerNames = game?.playerNames as Record<string, string> | undefined;
    const playerDetails = game?.playerDetails as any[] | undefined;
    let playerIds = game?.players || [];

    if (playerIds.length === 0) {
      wx.showToast({ title: '未获取到选手信息，请重新进入', icon: 'none' });
      return;
    }

    const detailMap = new Map(playerDetails ? playerDetails.map(d => [d._id, d]) : []);
    const members = playerIds.map((pid: string, idx: number) => {
      const cachedName = playerNames?.[pid];
      let d = detailMap.get(pid);
      if (!d && pid.startsWith('p_')) {
        for (const [key, val] of detailMap) {
          if (key === pid || key.includes(pid) || pid.includes(key)) { d = val; break; }
        }
      }
      return {
        _id: pid,
        nickname: cachedName || (d?.nickname || '').trim() || `选手${idx + 1}`,
        gender: d?.gender ?? 1,
        avatarUrl: d?.avatarUrl || ''
      };
    });

    let cannonScores = this.data.cannonScores;
    if (!cannonScores || Object.keys(cannonScores).length === 0) {
      cannonScores = {};
      playerIds.forEach((pid: string) => { cannonScores[pid] = 1; });
    }

    const result = calcBilling({
      courtFee, shuttleFee, otherFee,
      femaleDiscount: parseFloat(this.data.femaleDeductAmount) || 5,
      femaleFixedShuttle: parseFloat(this.data.femaleFixedAmount) || 0,
      femaleMode: this.data.femaleMode,
      cannonScores,
      members
    });

    const details = Object.entries(result.details).map(([mid, d]: [string, any]) => {
      const m = members.find(x => x._id === mid);
      return {
        memberId: mid,
        name: m?.nickname || `选手${members.indexOf(m) + 1}`,
        isFemale: m?.gender === 2,
        femaleLabel: d.isFemale ? (this.data.femaleMode === 'deduct' ? `立减${this.data.femaleDeductAmount}元` : `球费${this.data.femaleFixedAmount}元`) : '',
        paidAmount: 0,
        finalAmount: d.finalAmount ?? 0,
        discount: d.discount ?? 0,
        ...d,
        exempted: result.exemptedMembers.includes(mid)
      };
    });

    const playerCount = members.length || 1;
    const avg = Math.round((result.totalBill / playerCount) * 100) / 100;

    this.setData({ result, memberDetails: details, avgPerPerson: String(avg), billSaved: false });
  },

  onExempt(e: any) {
    const mid = e.currentTarget.dataset.id;
    if (!this.data.result) return;
    const result = exemptMember({ ...this.data.result, exemptedMembers: [...this.data.result.exemptedMembers] }, mid);
    const details = this.data.memberDetails.map(d => ({
      ...d,
      finalAmount: mid === d.memberId ? 0 : d.finalAmount,
      exempted: mid === d.memberId ? true : d.exempted
    }));
    this.setData({ result, memberDetails: details });
    wx.showToast({ title: '炮哥请客！', icon: 'none' });
  },

  onSaveBill() {
    const { result, memberDetails, gameId, courtFee, shuttle1Count, shuttle1Price,
            shuttle2Count, shuttle2Price, otherFee, femaleMode, femaleDeductAmount,
            femaleFixedAmount } = this.data;
    if (!result || !gameId) return;

    const billRecord = {
      totalBill: result.totalBill,
      courtFee: parseFloat(courtFee) || 0,
      shuttle1: {
        count: parseFloat(shuttle1Count) || 0,
        price: parseFloat(shuttle1Price) || 0
      },
      shuttle2: {
        count: parseFloat(shuttle2Count) || 0,
        price: parseFloat(shuttle2Price) || 0
      },
      otherFee: parseFloat(otherFee) || 0,
      femaleMode,
      femaleDiscount: parseFloat(femaleDeductAmount) || 5,
      femaleFixedShuttle: parseFloat(femaleFixedAmount) || 0,
      details: memberDetails.map(d => ({
        memberId: d.memberId,
        name: d.name,
        isFemale: d.isFemale,
        finalAmount: d.finalAmount,
        discount: d.discount,
        exempted: d.exempted,
        paidAmount: d.paidAmount || 0
      })),
      savedAt: new Date().toISOString()
    };

    const db = wx.cloud.database();
    db.collection('games').doc(gameId).update({
      data: { billing: billRecord }
    }).then(() => {
      this.setData({ billSaved: true });
      wx.showToast({ title: '已保存到本次记录', icon: 'success' });
      wx.removeStorageSync('billingGameData');
    }).catch(() => {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  }
});
