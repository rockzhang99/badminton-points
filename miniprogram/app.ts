// app.ts
App<IAppOption>({
  globalData: {
    userInfo: null,
    apiReady: true
  },

  onLaunch() {
    console.log('🏸 球局计分器启动');
    console.log('🌐 API 地址: https://badminton.caizhidao.cc');

    // 获取用户信息
    this.getUserInfo();
  },

  getUserInfo() {
    // 检查本地缓存
    const cached = wx.getStorageSync('userInfo');
    if (cached) {
      this.globalData.userInfo = cached;
    }
  }
});
