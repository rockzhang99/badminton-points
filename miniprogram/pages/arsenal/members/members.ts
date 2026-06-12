// pages/arsenal/members/members.ts
import { Member } from '../../../types/index';

Page({
  data: {
    members: [] as Member[],
    showAdd: false,
    newName: '',
    newGender: 1 as 1 | 2
  },

  onShow() {
    this.loadMembers();
  },

  async loadMembers() {
    const db = wx.cloud.database();
    try {
      const res = await db.collection('members').orderBy('createdAt', 'desc').get();
      this.setData({ members: res.data as Member[] });
      wx.setStorageSync('members', res.data);
    } catch {
      const cached = wx.getStorageSync('members') || [];
      this.setData({ members: cached });
    }
  },

  showAddForm() {
    this.setData({ showAdd: true, newName: '', newGender: 1 });
  },

  hideAddForm() {
    this.setData({ showAdd: false });
  },

  onNameInput(e: any) {
    this.setData({ newName: e.detail.value });
  },

  onGenderSelect(e: any) {
    this.setData({ newGender: parseInt(e.currentTarget.dataset.gender) });
  },

  async addMember() {
    const name = this.data.newName.trim();
    if (!name) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    const member = {
      nickname: name,
      gender: this.data.newGender,
      avatarUrl: '',
      stats: {
        totalScore: 0,
        totalGames: 0,
        cannonKingCount: 0,
        timesCannoned: 0,
        maxSingleScore: 0
      },
      badges: [],
      isCannonFodder: false,
      createdAt: new Date().toISOString()
    };

    const db = wx.cloud.database();
    try {
      await db.collection('members').add({ data: member });
    } catch {
      const cached = wx.getStorageSync('members') || [];
      member._id = `local_${Date.now()}`;
      cached.unshift(member);
      wx.setStorageSync('members', cached);
    }

    this.setData({ showAdd: false });
    this.loadMembers();
    wx.showToast({ title: '炮手加入！', icon: 'success' });
  },

  async toggleCannonFodder(e: any) {
    const id = e.currentTarget.dataset.id;
    const member = this.data.members.find(m => m._id === id);
    if (!member) return;

    const db = wx.cloud.database();
    const newStatus = !member.isCannonFodder;
    try {
      await db.collection('members').doc(id).update({
        data: { isCannonFodder: newStatus }
      });
    } catch {}

    this.loadMembers();
    wx.showToast({ title: newStatus ? '已标记为炮灰' : '已取消炮灰', icon: 'none' });
  },

  async deleteMember(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后该队员的比赛数据仍会保留',
      success: async res => {
        if (res.confirm) {
          const db = wx.cloud.database();
          try { await db.collection('members').doc(id).remove(); } catch {}
          this.loadMembers();
        }
      }
    });
  }
});
