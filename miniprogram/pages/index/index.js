Page({
  // 去跑步页面
  goRun() {
    wx.switchTab({
      url: '/pages/run/run',
    })
  },

  // 去历史记录
  goHistory() {
    wx.switchTab({
      url: '/pages/history/history',
    })
  }
})