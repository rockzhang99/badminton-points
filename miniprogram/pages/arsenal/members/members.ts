// pages/arsenal/members/members.ts
import { Member } from '../../../types/index';
import { memberApi, MemberRecord } from '../../../utils/api';

/** 将服务端 MemberRecord 转为前端 Member 格式 */
function toMember(m: MemberRecord): Member {
  return {
    _id: m._id || '',
    nickname: m.nickname,
    gender: m.gender as 1 | 2,
    avatarUrl: m.avatarUrl,
    stats: m.stats,
    badges: m.badges as any[],
    isCannonFodder: m.isCannonFodder,
    createdAt: m.createdAt
  };
}

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
    try {
      const res = await memberApi.list();
      const members = res.map(toMember);
      this.setData({ members });
      wx.setStorageSync('members', members);
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

    const memberData = {
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

    try {
      await memberApi.create(memberData);
    } catch {
      const cached = wx.getStorageSync('members') || [];
      const localMember = { ...memberData, _id: `local_${Date.now()}` };
      cached.unshift(localMember);
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

    const newStatus = !member.isCannonFodder;
    try {
      await memberApi.update(id, { isCannonFodder: newStatus } as any);
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
          try { await memberApi.remove(id); } catch {}
          this.loadMembers();
        }
      }
    });
  },

  onClearData() {
    wx.showModal({
      title: '炮灰粉碎',
      content: '确认清除所有本地数据？',
      success: res => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({ title: '炮灰已粉碎！', icon: 'success' });
        }
      }
    });
  }
});
