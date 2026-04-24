App({
  globalData: {
    userInfo: null
  },
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-3gihncdf6bc91351',
      traceUser: true
    })

    // 调用 check-user 云函数检查用户是否已注册
    this.checkUserRegistration()
  },

  // 检查用户是否已注册
  checkUserRegistration() {
    wx.cloud.callFunction({
      name: 'check-user'
    }).then(res => {
      if (res.result.success) {
        if (res.result.isRegistered) {
          // 已注册，跳转登录页
          wx.navigateTo({
            url: '/pages/login/login'
          })
        } else {
          // 未注册，跳转注册页
          wx.navigateTo({
            url: '/pages/register/register'
          })
        }
      } else {
        console.error('检查用户注册状态失败:', res)
      }
    }).catch(err => {
      console.error('调用 check-user 云函数失败:', err)
    })
  }
})