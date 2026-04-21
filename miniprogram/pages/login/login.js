Page({
  async handleLogin() {
    wx.showLoading({ title: '登录中...' })
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      
      console.log('🔍 login云函数完整返回:', res) 
      
      if (!res.result || !res.result.userInfo) {
        wx.hideLoading()
        wx.showToast({ title: '未查询到用户，请先注册', icon: 'none' })
        return
      }

      getApp().globalData.userInfo = res.result.userInfo
      wx.hideLoading()
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1000)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '登录失败', icon: 'error' })
      console.error('❌ 登录err:', err)
    }
  }
})