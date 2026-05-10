// pages/home.js
Page({
  data: {
    userInfo: {},
    historyList: [],
    page: 1,
    pageSize: 20,
    hasMore: true
  },

  onLoad() {
    this.loadRunHistory()
  },

  onShow() {
    this.getUserInfo()
  },

  getUserInfo() {
    const userInfo = getApp().globalData.userInfo || {}
    this.setData({ userInfo })
  },

  // 加载跑步历史
  loadRunHistory(isRefresh = false) {
    const { page, pageSize, historyList } = this.data
    const currentPage = isRefresh ? 1 : page

    wx.showLoading({ title: '加载中...' })
    wx.cloud.callFunction({
      name: 'getHistory',
      data: { page: currentPage, pageSize }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        const newList = res.result.data.map(item => ({
          ...item,
          createTime: this.formatTime(item.createTime)
        }))

        this.setData({
          historyList: isRefresh ? newList : [...historyList, ...newList],
          page: currentPage + 1,
          hasMore: res.result.hasMore
        })
      }
    }).catch(() => {
      wx.hideLoading()
    })
  },

  loadMoreHistory() {
    if (!this.data.hasMore) return
    this.loadRunHistory()
  },

  formatTime(timestamp) {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }
})