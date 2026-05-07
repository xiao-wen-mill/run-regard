// pages/home.js
Page({
  data: {
    userInfo: {},
    duration: '',
    distance: '',
    calories: 0,
    historyList: [],
    page: 1,
    pageSize: 20,
    hasMore: true
  },

  onLoad() {
    // 只加载记录，不自动登录
    this.loadRunHistory()
  },

  // 页面显示的时候再获取用户信息（安全）
  onShow() {
    this.getUserInfo()
  },

  // 安全获取用户信息（不会崩溃）
  getUserInfo() {
    const userInfo = getApp().globalData.userInfo || {}
    this.setData({ userInfo })
  },

  // 时长输入
  onDurationInput(e) {
    const duration = e.detail.value
    this.setData({ duration })
    this.calcCalories()
  },

  // 距离输入
  onDistanceInput(e) {
    const distance = e.detail.value
    this.setData({ distance })
    this.calcCalories()
  },

  // 计算热量
  calcCalories() {
    const { duration, distance } = this.data
    if (!duration || !distance) {
      this.setData({ calories: 0 })
      return
    }
    const calories = Math.round(Number(distance) * 60 + Number(duration) * 5)
    this.setData({ calories })
  },

  // 保存跑步记录
  saveRunRecord() {
    const { duration, distance, calories } = this.data
    if (!duration || !distance) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    wx.cloud.callFunction({
      name: 'saveRunRecord',
      data: { duration, distance, calories }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.setData({ duration: '', distance: '', calories: 0 })
        this.loadRunHistory(true)
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
      console.error('保存错误：', err)
    })
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