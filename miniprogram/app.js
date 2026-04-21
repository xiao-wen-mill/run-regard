App({
  globalData: {
    userInfo: null
  },
  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-3gihncdf6bc91351',
      traceUser: true
    })
  }
})