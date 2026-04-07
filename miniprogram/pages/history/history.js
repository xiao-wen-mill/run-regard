Page({
  data: {
    runHistory: []
  },

  onLoad() {
    // 从本地存储获取历史记录
    const history = wx.getStorageSync('runHistory') || []
    this.setData({ runHistory: history })
  }
})