App({
  globalData: {
    userInfo: null
  },
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-3gihncdf6bc91351',
      traceUser: true
    })

    // 读取本地登录标记
    const hasLogin = wx.getStorageSync('hasLogin')

    // 如果已经登录过，直接进首页
    if (hasLogin) {
      wx.switchTab({
        url: '/pages/home/home'
      })
      return
    }

    // 未登录过：检查用户是否已注册
    this.checkUserRegistration()
  },

  // 检查用户是否已注册
  checkUserRegistration() {
    wx.cloud.callFunction({
      name: 'check-user'
    }).then(res => {
      if (res.result.success) {
        if (res.result.isRegistered) {
          // 已注册但未登录，跳登录页
          wx.redirectTo({
            url: '/pages/login/login'
          })
        }
        // 未注册：停在当前注册页，不跳转
      }
    }).catch(err => {
      console.error('调用 check-user 云函数失败:', err)
    })
  }
})