Page({
  handleLogin(e) {
    if (e.detail.userInfo) {
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })
      // 跳转到跑步记录页
      wx.switchTab({
        url: '/pages/run/run'
      })
    } else {
      wx.showToast({
        title: '登录失败',
        icon: 'error'
      })
    }
  }
})