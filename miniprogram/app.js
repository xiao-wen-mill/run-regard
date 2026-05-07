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
    }
    // 没登录过：啥也不做，原地停在注册页，不跳转！
  },

  // 保留这个函数，但自动不调用了
  checkUserRegistration() {
    wx.cloud.callFunction({
      name: 'check-user'
    }).then(res => {
      if (res.result.success) {
        if (res.result.isRegistered) {
          wx.navigateTo({
            url: '/pages/login/login'
          })
        }
      }
    }).catch(err => {
      console.error('调用 check-user 云函数失败:', err)
    })
  }
})