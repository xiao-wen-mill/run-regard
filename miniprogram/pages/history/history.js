Page({
  data: {
    recordList: [],
    page: 1,
    pageSize: 100,
    hasMore: false,
  },

  onShow() {
    this.setData({
      page: 1,
      hasMore: false,
      recordList: [],
    });
    this.loadHistory();
  },

  loadHistory() {
    wx.showLoading({ title: '加载中...' });
    wx.cloud.callFunction({
      name: 'get-history',
      data: { page: 1, pageSize: this.data.pageSize },
    }).then((res) => {
      wx.hideLoading();
      if (res.result && res.result.success) {
        const list = res.result.data.map((item) => ({
          ...item,
          durationText: this.formatDuration(item.duration),
          distanceKm: (item.distance / 1000).toFixed(2),
          paceText: this.formatPace(item.avgPace),
          createTimeText: this.formatTime(item.createTime),
        }));
        this.setData({
          recordList: list,
          hasMore: res.result.hasMore,
        });
      }
    }).catch((err) => {
      wx.hideLoading();
      console.error('加载历史失败：', err);
    });
  },

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}时${m}分${s}秒`;
    }
    return `${m}分${s}秒`;
  },

  formatPace(pace) {
    if (!pace) return '00:00';
    return pace;
  },

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}`;
  },
});