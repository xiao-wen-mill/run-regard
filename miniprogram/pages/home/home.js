const db = wx.cloud.database();

// pages/home.js
Page({
  data: {
    userInfo: {},
    historyList: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    totalDistance: 0,
    totalRunCount: 0,
  },

  onLoad() {
    this.loadRunHistory();
  },

  onShow() {
    this.getUserInfo();
  },

  getUserInfo() {
    const userInfo = getApp().globalData.userInfo || {};
    const processedUserInfo = {
      ...userInfo,
      totalDistance: userInfo.totalDistance
        ? userInfo.totalDistance.toFixed(2)
        : "0",
      totalDuration: userInfo.totalDuration
        ? (userInfo.totalDuration / 60).toFixed(1)
        : "0",
    };
    this.setData({ userInfo: processedUserInfo });
  },

  goToRun() {
    wx.switchTab({ url: "/pages/run/run" });
  },

  loadRunHistory(isRefresh = false) {
    const { page, pageSize, historyList } = this.data;
    const currentPage = isRefresh ? 1 : page;
    const skip = (currentPage - 1) * pageSize;

    wx.showLoading({ title: "加载中..." });
    db.collection("run_records")
      .orderBy("createTime", "desc")
      .skip(skip)
      .limit(pageSize)
      .get()
      .then((res) => {
        wx.hideLoading();
        const newList = res.data.map((item) => ({
          ...item,
          createTime: this.formatTime(item.createTime),
          durationText: this.formatDuration(item.duration),
          distanceKm: (item.distance / 1000).toFixed(2),
        }));

        if (isRefresh || currentPage === 1) {
          this.calculateTotals(res.data);
        }

        this.setData({
          historyList: isRefresh ? newList : [...historyList, ...newList],
          page: currentPage + 1,
          hasMore: newList.length >= pageSize,
        });
      })
      .catch(() => {
        wx.hideLoading();
      });
  },

  calculateTotals(records) {
    db.collection("run_records")
      .get()
      .then((res) => {
        let totalDistance = 0;
        let totalRunCount = 0;

        res.data.forEach((item) => {
          totalDistance += item.distance || 0;
          totalRunCount++;
        });

        this.setData({
          totalDistance: (totalDistance / 1000).toFixed(2),
          totalRunCount: totalRunCount,
        });
      });
  },

  loadMoreHistory() {
    if (!this.data.hasMore) return;
    this.loadRunHistory();
  },

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  },
});
