const db = wx.cloud.database()

Page({
  data: {
    recordList: []
  },

  onShow: function () {
    this.getRunRecords()
  },

  getRunRecords: function () {
    var that = this
    wx.showLoading({
      title: '加载中...',
    })
    db.collection('run_records').orderBy('createTime', 'desc').get().then(res => {
      wx.hideLoading()
      that.setData({
        recordList: res.data
      })
    }).catch(err => {
      wx.hideLoading()
      console.error(err)
    })
  },

  formatTime: function (s) {
    var h = Math.floor(s / 3600)
    var m = Math.floor((s % 3600) / 60)
    var sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  },

  formatPace: function (sec) {
    if (!sec) return '00:00'
    var m = Math.floor(sec / 60)
    var s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  },

  distanceKm: function (m) {
    return (m / 1000).toFixed(2)
  }
})