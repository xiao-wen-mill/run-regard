Page({
  // 👉 只改这里：按钮点击先弹授权
  async handleLogin() {
    // 👇 就加这一段！弹微信授权
    await wx.getUserProfile({
      desc: "用于登录跑步小程序",
    })

    // ==============================
    // 下面是你原来的代码，一行不动！
    // ==============================
    wx.showLoading({ title: '登录中...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })

      console.log('🔍 login云函数完整返回:', res)

      if (res.result.success) {
        getApp().globalData.userInfo = res.result.userInfo
        wx.hideLoading()
        wx.showToast({ title: '登录成功', icon: 'success' })
        wx.setStorageSync('hasLogin', true)
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1000)
      } else {
        wx.hideLoading()
        const msg = res.result.message || '登录失败'
        
        if (msg.includes('未注册') || msg.includes('未找到')) {
          wx.showToast({ title: '请先注册', icon: 'none' })
          setTimeout(() => {
            wx.navigateTo({ url: '/pages/register/register' })
          }, 1500)
        } else {
          wx.showToast({ title: msg, icon: 'none' })
        }
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '登录失败', icon: 'error' })
      console.error('❌ 登录err:', err)
    }
  }
})