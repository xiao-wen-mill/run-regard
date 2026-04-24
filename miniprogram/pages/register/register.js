Page({
  data: { avatarUrl: '', nickName: '' },

  // 点击授权按钮，获取用户信息
  async getProfile() {
    try {
      // 调用 wx.getUserProfile 获取用户信息
      const res = await wx.getUserProfile({
        desc: '用于完善用户资料',
        lang: 'zh_CN'
      })

      const userInfo = res.userInfo
      this.setData({
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl
      })

      // 自动调用注册函数
      this.handleRegister()
    } catch (err) {
      console.error('获取用户信息失败:', err)
      wx.showToast({ title: '授权失败', icon: 'none' })
    }
  },

  async handleRegister() {
    if (!this.data.nickName || !this.data.avatarUrl) {
      return wx.showToast({ title: '请先授权获取用户信息', icon: 'none' })
    }
    wx.showLoading({ title: '注册中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'register',
        data: {
          nickName: this.data.nickName,
          avatarUrl: this.data.avatarUrl
        }
      })
      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '注册成功！跳转主页...' })
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1200)
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '注册失败', icon: 'error' })
      console.error('注册err:', err)
    }
  }
})