// pages/home.js
Page({
  data: {
    userInfo: {},
    historyList: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
  },

  onLoad() {
  },

  onShow() {
    this.getUserInfo();
    this.setData({
      page: 1,
      hasMore: true,
      historyList: [],
    });
    this.loadRunHistory(true);
  },

  getUserInfo() {
    const globalUserInfo = getApp().globalData.userInfo || {};
    const currentUserInfo = this.data.userInfo || {};
    this.setData({
      userInfo: {
        ...currentUserInfo,
        nickName: globalUserInfo.nickName || '微信用户',
        avatarUrl: globalUserInfo.avatarUrl || '',
      },
    });
  },

  // 跳转到跑步页面
  goToRun() {
    wx.switchTab({ url: "/pages/run/run" });
  },

  // 加载跑步历史
  loadRunHistory(isRefresh = false) {
    const { page, pageSize, historyList } = this.data;
    const currentPage = isRefresh ? 1 : page;

    wx.showLoading({ title: "加载中..." });
    wx.cloud
      .callFunction({
        name: "get-history",
        data: { page: currentPage, pageSize },
      })
      .then((res) => {
        wx.hideLoading();
        if (res.result.success) {
          const newList = res.result.data.map((item) => ({
            ...item,
            createTime: this.formatTime(item.createTime),
            durationMin: (item.duration / 60).toFixed(1),
            distanceKm: (item.distance / 1000).toFixed(2),
          }));

          const mergedList = isRefresh ? newList : [...historyList, ...newList];

          const stats = res.result.stats || {};
          const totalKm = ((stats.totalDistance || 0) / 1000).toFixed(2);
          const totalRunCount = stats.totalRunCount || 0;

          const userInfo = {
            ...(this.data.userInfo || {}),
            totalDistance: totalKm,
            totalRunCount: totalRunCount,
          };

          this.setData({
            historyList: mergedList,
            page: currentPage + 1,
            hasMore: res.result.hasMore,
            userInfo: userInfo,
          });
        }
      })
      .catch(() => {
        wx.hideLoading();
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
});