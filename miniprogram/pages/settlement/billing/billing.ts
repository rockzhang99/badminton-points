// pages/settlement/billing/billing.ts
import { calcBilling, exemptMember, BillingParams, BillingResult } from '../../../utils/billing';

Page({
  data: {
    gameId: '',
    game: null as any,

    // 费用输入
    courtFee: '',
    shuttleFee: '',
    otherFee: '',
    femaleDiscount: 5,

    // 计算结果
    result: null as BillingResult | null,
    memberDetails: [] as any[],
    cannonScores: {} as Record<string, number>
  },

  onLoad(options: any) {
    this.setData({ gameId: options.gameId || '' });
    this.loadGame();
  },

  async loadGame() {
    if (!this.data.gameId) {
      // 从全局取最近结果
      const app = getApp<IAppOption>();
      const gd = app.globalData.currentGame as any;
      if (gd) {
        this.setData({
          game: gd,
          cannonScores: gd.cannonScores || {}
        });
      }
      return;
    }

    const db = wx.cloud.database();
    try {
      const res = await db.collection('games').doc(this.data.gameId).get();
      this.setData({
        game: res.data,
        cannonScores: (res.data as any).cannonScores || {}
      });
    } catch {}
  },

  onCourtFeeInput(e: any) { this.setData({ courtFee: e.detail.value }); },
  onShuttleFeeInput(e: any) { this.setData({ shuttleFee: e.detail.value }); },
  onOtherFeeInput(e: any) { this.setData({ otherFee: e.detail.value }); },

  onCalc() {
    const courtFee = parseFloat(this.data.courtFee) || 0;
    const shuttleFee = parseFloat(this.data.shuttleFee) || 0;
    const otherFee = parseFloat(this.data.otherFee) || 0;

    if (courtFee + shuttleFee + otherFee === 0) {
      wx.showToast({ title: '请至少输入一项费用', icon: 'none' });
      return;
    }

    const members = (this.data.game?.players || []).map((pid: string) => ({
      _id: pid,
      nickname: pid.slice(0, 6),
      gender: 1 as const,
      avatarUrl: ''
    }));

    const result = calcBilling({
      courtFee, shuttleFee, otherFee,
      femaleDiscount: this.data.femaleDiscount,
      cannonScores: this.data.cannonScores,
      members
    });

    const details = Object.entries(result.details).map(([mid, d]) => ({
      memberId: mid,
      name: members.find(m => m._id === mid)?.nickname || mid.slice(0, 6),
      ...d,
      exempted: result.exemptedMembers.includes(mid)
    }));

    this.setData({ result, memberDetails: details });
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
  }
});
