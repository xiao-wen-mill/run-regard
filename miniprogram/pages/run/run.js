Page({
  data: {
    isRunning: false,
    time: 0,
    timeStr: "00:00:00",
    distance: 0,
    distanceKm: "0.00",
    speed: 0,
    paceStr: "00:00",
    calories: 0,
    startTime: null,
    gpsPoints: [],
    lastLat: 0,
    lastLng: 0
  },

  timer: null,
  locationWatch: null,

  // 👉 我在这里加了：页面加载就强制申请定位权限
  onLoad() {
    this.requestLocationPermission()
  },

  // 👉 强制获取定位权限（一定会弹框）
  requestLocationPermission() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.userLocation']) {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              console.log("定位授权成功")
            },
            fail: () => {
              wx.showToast({
                title: '请开启定位权限',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  },

  startRun() {
    const app = getApp()
    if (!app.globalData.userInfo) {
      wx.showToast({ title: "请先登录", icon: "none" })
      return
    }

    this.setData({
      isRunning: true,
      time: 0,
      timeStr: "00:00:00",
      distance: 0,
      distanceKm: "0.00",
      speed: 0,
      paceStr: "00:00",
      calories: 0,
      startTime: new Date().toISOString(),
      gpsPoints: [],
      lastLat: 0,
      lastLng: 0
    })

    wx.startLocationUpdate({ type: "gcj02" })

    this.timer = setInterval(() => {
      this.setData({ time: this.data.time + 1 })
      const h = Math.floor(this.data.time / 3600)
      const m = Math.floor((this.data.time % 3600) / 60)
      const s = this.data.time % 60
      this.setData({
        timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      })
      this.calcRealTimeData()
    }, 1000)

    this.locationWatch = wx.onLocationChange(res => {
      const point = {
        latitude: res.latitude,
        longitude: res.longitude,
        timestamp: Date.now()
      }
      this.setData({
        gpsPoints: [...this.data.gpsPoints, point]
      })

      if (this.data.lastLat && this.data.lastLng) {
        const dis = this.getDistance(this.data.lastLat, this.data.lastLng, res.latitude, res.longitude)
        const timeDiff = point.timestamp - (this.data.gpsPoints[this.data.gpsPoints.length-2]?.timestamp || point.timestamp)
        const speed = dis / (timeDiff/1000)
        if (speed <= 10) {
          const newDis = this.data.distance + dis
          this.setData({
            distance: newDis,
            distanceKm: (newDis / 1000).toFixed(2)
          })
        }
      }
      this.setData({ lastLat: res.latitude, lastLng: res.longitude })
    })
  },

  calcRealTimeData() {
    const durationMin = this.data.time / 60
    const distanceKm = this.data.distance / 1000
    let paceStr = "00:00"
    let calories = 0
    const weight = 60

    if (distanceKm > 0) {
      const paceMin = durationMin / distanceKm
      const pMin = Math.floor(paceMin)
      const pSec = Math.round((paceMin - pMin)*60)
      paceStr = `${String(pMin).padStart(2,'0')}:${String(pSec).padStart(2,'0')}`
    }

    calories = Math.round(weight * distanceKm * 1.036)
    this.setData({ paceStr, calories })
  },

  stopRun() {
    clearInterval(this.timer)
    wx.offLocationChange(this.locationWatch)
    wx.stopLocationUpdate()
    this.setData({ isRunning: false })

    const endTime = new Date().toISOString()

    wx.cloud.callFunction({
      name: "saveRunRecord",
      data: {
        duration: this.data.time,
        distance: Math.round(this.data.distance),
        calories: this.data.calories,
        avgPace: this.data.paceStr,
        startTime: this.data.startTime,
        endTime: endTime,
        gpsPoints: this.data.gpsPoints
      }
    }).then(res => {
      wx.showToast({ title: "保存成功" })
    }).catch(err => {
      wx.showToast({ title: "保存失败", icon: "none" })
    })
  },

  getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }
})