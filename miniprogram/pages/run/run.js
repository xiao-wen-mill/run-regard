Page({
  data: {
    isRunning: false,
    timeText: '00:00:00',
    timer: null,
    seconds: 0
  },

  startRun() {
    this.setData({ isRunning: true })
    this.data.timer = setInterval(() => {
      this.data.seconds++
      this.setData({
        timeText: this.formatTime(this.data.seconds)
      })
    }, 1000)
  },

  stopRun() {
    clearInterval(this.data.timer)
    this.setData({ isRunning: false })
    // 保存本次跑步记录到本地
    let history = wx.getStorageSync('runHistory') || []
    history.push({
      time: new Date().toLocaleString(),
      duration: this.data.timeText
    })
    wx.setStorageSync('runHistory', history)
    wx.showToast({
      title: '跑步结束',
      icon: 'success'
    })
  },

  formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  },

  onUnload() {
    if (this.data.timer) clearInterval(this.data.timer)
  }
})