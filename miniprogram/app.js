App({
  globalData: {
    userInfo: null,
  },
  onLaunch() {
    wx.cloud.init({
      env: "cloud1-3gihncdf6bc91351",
      traceUser: true,
    });
    // 👉 开发测试阶段暂时注释掉自动登录验证，方便在模拟器查看登录/注册页面
    // this.checkUserRegistration()
  },

  onShow() {
    // 👉 开发测试阶段暂时注释掉自动登录验证
    // this.checkUserRegistration()
  },

  checkUserRegistration() {
    wx.cloud
      .callFunction({
        name: "check-user",
      })
      .then((res) => {
        if (res.result.success && res.result.isRegistered) {
          if (res.result.userInfo) {
            this.globalData.userInfo = res.result.userInfo;
          }
          const pages = getCurrentPages();
          const currentPage = pages[pages.length - 1];
          if (currentPage && currentPage.route !== "pages/home/home") {
            wx.switchTab({ url: "/pages/home/home" });
          }
        } else {
          wx.redirectTo({ url: "/pages/login/login" });
        }
      })
      .catch((err) => {
        console.error("调用 check-user 云函数失败:", err);
        wx.redirectTo({ url: "/pages/login/login" });
      });
  },

  async verifyLogin() {
    try {
      const res = await wx.cloud.callFunction({ name: "login" });
      if (res.result.success) {
        this.globalData.userInfo = res.result.userInfo;
        return true;
      }
      wx.redirectTo({ url: "/pages/login/login" });
      return false;
    } catch (err) {
      console.error("调用 login 云函数失败:", err);
      wx.redirectTo({ url: "/pages/login/login" });
      return false;
    }
  },
});
