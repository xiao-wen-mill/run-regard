Page({
  async handleLogin() {
    wx.showLoading({ title: '登录中...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })

      console.log('🔍 login云函数完整返回:', res)

      if (res.result.success) {
        // 登录成功，保存用户信息到全局
        getApp().globalData.userInfo = res.result.userInfo
        wx.hideLoading()
        wx.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1000)
      } else {
        // 登录失败，用户未注册，跳转到注册页
        wx.hideLoading()
        wx.showToast({ title: res.result.message, icon: 'none' })
        setTimeout(() => wx.navigateTo({ url: '/pages/register/register' }), 1000)
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '登录失败', icon: 'error' })
      console.error('❌ 登录err:', err)
    }
  }
})