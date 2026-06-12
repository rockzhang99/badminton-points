// app.ts
App<IAppOption>({
  globalData: {
    userInfo: null,
    isCloudReady: false
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'starcannon-prod',    // 云环境 ID，需替换为实际环境
        traceUser: true
      });
      this.globalData.isCloudReady = true;
    }

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
