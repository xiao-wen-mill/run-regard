App({
  globalData: {
    userInfo: null
  },
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-3gihncdf6bc91351',
      traceUser: true
    })
    // 每次启动都强制调用 check-user 云函数验证用户状态
    this.checkUserRegistration()
  },

  onShow() {
    // 每次小程序显示时也强制验证用户状态
    this.checkUserRegistration()
  },

  checkUserRegistration() {
    wx.cloud.callFunction({
      name: 'check-user'
    }).then(res => {
      // 云侧用户有效 → 进首页
      if (res.result.success && res.result.isRegistered) {
        // 更新全局用户信息
        if (res.result.userInfo) {
          this.globalData.userInfo = res.result.userInfo
        }
        // 如果当前不在首页，跳转到首页
        const pages = getCurrentPages()
        const currentPage = pages[pages.length - 1]
        if (currentPage && currentPage.route !== 'pages/home/home') {
          wx.switchTab({ url: '/pages/home/home' })
        }
      } else {
        // 云侧无效/未注册 → 强制跳转到登录页
        wx.redirectTo({ url: '/pages/login/login' })
      }
    }).catch(err => {
      console.error('调用 check-user 云函数失败:', err)
      // 云函数异常 → 强制跳转到登录页
      wx.redirectTo({ url: '/pages/login/login' })
    })
  },

  // 验证登录态，用于需要登录的操作前调用
  async verifyLogin() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      if (res.result.success) {
        this.globalData.userInfo = res.result.userInfo
        return true
      }
      // 登录失败，跳转到登录页
      wx.redirectTo({ url: '/pages/login/login' })
      return false
    } catch (err) {
      console.error('调用 login 云函数失败:', err)
      wx.redirectTo({ url: '/pages/login/login' })
      return false
    }
  }
})