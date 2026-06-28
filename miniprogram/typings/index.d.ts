// typings/index.d.ts
// 全局类型声明

interface IAppOption {
  globalData: {
    userInfo: WechatMiniprogram.UserInfo | null;
    apiReady: boolean;
    currentGame?: any;
  };
  getUserInfo: () => void;
}
