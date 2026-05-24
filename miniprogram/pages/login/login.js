Page({
  async handleLogin() {
    wx.showLoading({ title: "登录中..." });

    try {
      // 尝试调用登录云函数
      const res = await wx.cloud.callFunction({ name: "login" });

      console.log("🔍 login云函数返回:", res);

      if (res.result.success) {
        getApp().globalData.userInfo = res.result.userInfo;
        wx.hideLoading();
        wx.showToast({ title: "登录成功", icon: "success" });
        wx.setStorageSync("hasLogin", true);

        // 直接跳转到首页
        setTimeout(() => {
          wx.switchTab({
            url: "/pages/home/home",
            success: () => {
              console.log("✅ 成功跳转到首页");
            },
            fail: (err) => {
              console.error("❌ 跳转失败:", err);
              // 如果switchTab失败，尝试用redirectTo
              wx.redirectTo({ url: "/pages/home/home" });
            },
          });
        }, 1000);
      } else {
        wx.hideLoading();
        const msg = res.result.message || "登录失败";

        if (msg.includes("未注册") || msg.includes("未找到")) {
          wx.showToast({ title: "请先注册", icon: "none" });
          setTimeout(() => {
            wx.navigateTo({ url: "/pages/register/register" });
          }, 1500);
        } else {
          wx.showToast({ title: msg, icon: "none" });
        }
      }
    } catch (err) {
      wx.hideLoading();
      console.error("❌ 登录异常:", err);

      // 如果云函数调用失败，给用户提示并尝试跳转到首页
      wx.showToast({
        title: "登录失败，请检查网络",
        icon: "error",
      });
    }
  },

  goRegister() {
    wx.navigateTo({ url: "/pages/register/register" });
  },
});
