Page({
  data: {
    nickName: '',
    isChecked: false
  },

  // 输入昵称
  onNickInput(e) {
    this.setData({
      nickName: e.detail.value
    })
  },

  // 切换勾选状态
  toggleCheck() {
    this.setData({
      isChecked: !this.data.isChecked
    })
  },

  // 注册
  async handleRegister() {
    const { nickName, isChecked } = this.data

    if (!nickName) {
      return wx.showToast({ title: '请输入昵称', icon: 'none' })
    }
    if (!isChecked) {
      return wx.showToast({ title: '请先勾选授权信息', icon: 'none' })
    }

    wx.showLoading({ title: '注册中...' })
    try {
      // 传给后端：昵称，头像固定给一个默认值
      const res = await wx.cloud.callFunction({
        name: 'register',
        data: {
          nickName: nickName,
          avatarUrl: ''  // 头像不用，传空就行，让组长后端兼容
        }
      })

      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '注册成功！跳转主页...' })
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1200)
      } else {
        wx.showToast({ title: res.result.message || '注册失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '注册失败', icon: 'error' })
      console.error('注册错误：', err)
    }
  }
})