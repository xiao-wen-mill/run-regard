// pages/index/index.js
Page({
  data: {
    duration: '',   // 跑步时长（分钟）
    distance: ''    // 跑步距离（公里）
  },

  // 输入框绑定
  onDurationInput(e) {
    this.setData({ duration: e.detail.value })
  },

  onDistanceInput(e) {
    this.setData({ distance: e.detail.value })
  },

  // 保存跑步记录
  saveRunRecord() {
    const { duration, distance } = this.data

    // 前端校验
    if (!duration || !distance) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '保存中...', mask: true })

    wx.cloud.callFunction({
      name: 'saveRunRecord',
      data: {
        duration: Number(duration),
        distance: Number(distance)
      },
      success: res => {
        wx.hideLoading()
        console.log('云函数返回', res)

        if (res.result && res.result.success) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          })
          // 清空表单
          this.setData({
            duration: '',
            distance: ''
          })
        } else {
          wx.showToast({
            title: res.result?.message || '保存失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error('云函数调用失败', err)
        wx.showToast({
          title: '网络异常，请稍后重试',
          icon: 'none'
        })
      }
    })
  }
})