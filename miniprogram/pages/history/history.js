Page({
  data: {
    activeTab: "run",
    runRecords: [],
    jumpRecords: [],
  },

  onShow: function () {
    const tabBar = this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 3 });

    if (this.data.activeTab === "run") {
      this.getRunRecords();
    } else {
      this.getJumpRecords();
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    if (tab === "run") {
      this.getRunRecords();
    } else {
      this.getJumpRecords();
    }
  },

  getRunRecords: function () {
    var that = this;
    wx.showLoading({ title: "加载中..." });
    wx.cloud
      .callFunction({
        name: "get-history",
        data: { type: "run" },
      })
      .then((res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          var newList = res.result.data.map((item) => {
            let duration = item.duration || 0;
            let minutes = Math.floor(duration / 60);
            let seconds = duration % 60;

            let avgPace = item.avgPace || 0;
            if (avgPace === 0 && item.distance > 0 && duration > 0) {
              avgPace = Math.round(duration / (item.distance / 1000));
            }

            return {
              ...item,
              durationText: minutes + "分" + seconds + "秒",
              createTime: that.formatDateTime(item.createTime),
              distanceText: that.distanceKm(item.distance || 0) + " km",
              paceText: that.formatPace(avgPace) + " /km",
              calories: item.calories || 0,
            };
          });
          that.setData({ runRecords: newList });
        } else {
          that.showLoadError((res.result && res.result.message) || "加载失败");
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("加载跑步记录失败:", err);
        const code = err && err.errCode ? `[${err.errCode}] ` : "";
        that.showLoadError(
          "调用 get-history 失败：" +
            code +
            ((err && (err.errMsg || err.message)) || "请重试"),
        );
      });
  },

  getJumpRecords: function () {
    var that = this;
    wx.showLoading({ title: "加载中..." });
    wx.cloud
      .callFunction({
        name: "get-history",
        data: { type: "jump" },
      })
      .then((res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          var newList = res.result.data.map((item) => {
            let duration = item.duration || 0;
            let minutes = Math.floor(duration / 60);
            let seconds = duration % 60;
            let calories =
              item.calories != null
                ? item.calories
                : Math.round((item.count || 0) * 0.3);

            return {
              ...item,
              durationText: minutes + "分" + seconds + "秒",
              createTime: that.formatDateTime(item.createTime),
              calories: calories,
            };
          });
          that.setData({ jumpRecords: newList });
        } else {
          that.showLoadError((res.result && res.result.message) || "加载失败");
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("加载跳绳记录失败:", err);
        const code = err && err.errCode ? `[${err.errCode}] ` : "";
        that.showLoadError(
          "调用 get-history 失败：" +
            code +
            ((err && (err.errMsg || err.message)) || "请重试"),
        );
      });
  },

  /**
   * 加载失败用弹窗展示完整原因（toast 一闪而过看不清）
   */
  showLoadError(message) {
    wx.showModal({
      title: "加载失败",
      content: String(message || "请重试"),
      showCancel: false,
      confirmText: "知道了",
    });
  },

  formatDateTime: function (timestamp) {
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === "string" || typeof timestamp === "number") {
      date = new Date(timestamp);
    } else if (timestamp && typeof timestamp === "object") {
      // 云函数返回的时间可能是 { $date: 毫秒 } / { time: 毫秒 }
      const ms = timestamp.$date || timestamp.time || timestamp.date;
      date = ms ? new Date(ms) : new Date();
    } else {
      date = new Date();
    }
    if (isNaN(date.getTime())) {
      date = new Date();
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  formatPace: function (sec) {
    if (!sec) return "00:00";
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  },

  distanceKm: function (m) {
    return (m / 1000).toFixed(2);
  },
});
