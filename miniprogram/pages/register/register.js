Page({
  data: { avatarUrl: '', nickName: '' },

  onChooseAvatar(e) { 
    this.setData({ avatarUrl: e.detail.avatarUrl }) 
  },

  onNicknameInput(e) { 
    this.setData({ nickName: e.detail.value }) 
  },
  
  async handleRegister() {
    if (!this.data.nickName || !this.data.avatarUrl) {
      return wx.showToast({ title: '请选头像+填昵称', icon: 'none' })
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
      wx.showToast({ title: '注册成功！跳转登录...' })
      setTimeout(() => wx.redirectTo({ url: '/pages/login/login' }), 1200)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '注册失败', icon: 'error' })
      console.error('注册err:', err)
    }
  }
})