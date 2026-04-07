// pages/home.js
Page({
  data: {
    // 用户信息
    userInfo: {},
    // 录入数据
    duration: '',
    distance: '',
    calories: 0,
    // 历史记录
    historyList: [],
    page: 1,
    pageSize: 20,
    hasMore: true
  },

  // 页面加载时执行
  onLoad() {
    // 1. 调用登录云函数，获取用户信息
    this.loginUser()
    // 2. 加载跑步历史记录
    this.loadRunHistory()
  },

  // 调用userLogin云函数，登录/初始化用户
  loginUser() {
    wx.showLoading({ title: '加载中...' })
    wx.cloud.callFunction({
      name: 'userLogin',
      data: {
        // 前端可传用户昵称、头像（微信授权后获取）
        nickname: wx.getStorageSync('userInfo').nickName || '',
        avatarUrl: wx.getStorageSync('userInfo').avatarUrl || ''
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        // 更新用户信息
        this.setData({
          userInfo: res.result.userInfo
        })
        // 新用户提示
        if (res.result.isNewUser) {
          wx.showToast({ title: '欢迎新用户！', icon: 'success' })
        }
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '登录失败', icon: 'none' })
      console.error('登录错误：', err)
    })
  },

  // 时长输入
  onDurationInput(e) {
    const duration = e.detail.value
    this.setData({ duration })
    // 自动计算热量（公式：热量≈ 距离(km) × 60 + 时长(min) × 5，可根据需求调整）
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
    // 简单计算公式，可根据实际需求优化
    const calories = Math.round(Number(distance) * 60 + Number(duration) * 5)
    this.setData({ calories })
  },

  // 调用saveRunRecord云函数，保存跑步记录
  saveRunRecord() {
    const { duration, distance, calories } = this.data
    // 校验输入
    if (!duration || !distance) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    wx.cloud.callFunction({
      name: 'saveRunRecord',
      data: {
        duration,
        distance,
        calories
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: res.result.message, icon: 'success' })
        // 清空输入框
        this.setData({
          duration: '',
          distance: '',
          calories: 0
        })
        // 刷新用户信息和历史记录
        this.loginUser()
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

  // 调用getHistory云函数，加载跑步历史
  loadRunHistory(isRefresh = false) {
    const { page, pageSize, historyList } = this.data
    // 刷新时重置页码
    const currentPage = isRefresh ? 1 : page

    wx.showLoading({ title: '加载中...' })
    wx.cloud.callFunction({
      name: 'getHistory',
      data: {
        page: currentPage,
        pageSize
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        // 处理数据
        const newList = res.result.data.map(item => ({
          ...item,
          createTime: this.formatTime(item.createTime)
        }))

        this.setData({
          historyList: isRefresh ? newList : [...historyList, ...newList],
          page: currentPage + 1,
          hasMore: res.result.hasMore
        })
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
      console.error('历史加载错误：', err)
    })
  },

  // 加载更多历史
  loadMoreHistory() {
    if (!this.data.hasMore) return
    this.loadRunHistory()
  },

  // 时间格式化工具
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