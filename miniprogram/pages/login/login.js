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
        
        // ======================================
        // 👉 我在这里加了【记住登录状态】
        // 下次打开小程序，直接进首页，不用再注册！
        // ======================================
        wx.setStorageSync('hasLogin', true)

        console.log('准备跳转')
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1000)
      } else {
        // ======================================
        // 关键在这里：如果提示未注册，自动跳注册页
        // ======================================
        wx.hideLoading()
        const msg = res.result.message || '登录失败'
        
        if (msg.includes('未注册') || msg.includes('未找到')) {
          wx.showToast({ title: '请先注册', icon: 'none' })
          // 自动跳注册页！！！
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