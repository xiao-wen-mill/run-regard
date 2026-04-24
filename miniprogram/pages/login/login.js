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
        console.log('准备跳转')
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1000)
      } else {
        // 登录失败，显示错误信息
        wx.hideLoading()
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '登录失败', icon: 'error' })
      console.error('❌ 登录err:', err)
    }
  }
})