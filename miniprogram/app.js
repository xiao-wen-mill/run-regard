App({
  globalData: {
    userInfo: null
  },
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-3gihncdf6bc91351',
      traceUser: true
    })

    const hasLogin = wx.getStorageSync('hasLogin')
    // 有登录标记 → 校验云侧用户是否有效
    if (hasLogin) {
      this.checkUserRegistration()
      return
    }
    // 无登录标记 → 强制去登录页
    wx.redirectTo({ url: '/pages/login/login' })
  },

  checkUserRegistration() {
    wx.cloud.callFunction({
      name: 'check-user'
    }).then(res => {
      // 云侧用户有效 → 进首页
      if (res.result.success && res.result.isRegistered) {
        wx.switchTab({ url: '/pages/home/home' })
      } else {
        // 云侧无效/未注册 → 清除本地缓存，强制登录
        wx.removeStorageSync('hasLogin')
        wx.redirectTo({ url: '/pages/login/login' })
      }
    }).catch(err => {
      console.error('调用 check-user 云函数失败:', err)
      // 云函数异常 → 清除缓存，强制登录
      wx.removeStorageSync('hasLogin')
      wx.redirectTo({ url: '/pages/login/login' })
    })
  }
})