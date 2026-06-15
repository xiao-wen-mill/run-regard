const db = wx.cloud.database();

Page({
  data: {
    recordList: [],
  },

  onShow: function () {
    this.getRunRecords();
  },

  getRunRecords: function () {
    var that = this;
    wx.showLoading({
      title: "加载中...",
    });
    db.collection("run_records")
      .orderBy("createTime", "desc")
      .get()
      .then((res) => {
        wx.hideLoading();
        console.log("获取到的跑步记录数量:", res.data.length);
        res.data.forEach((item, index) => {
          console.log(
            `记录${index}: avgPace=${item.avgPace}, distance=${item.distance}, duration=${item.duration}`,
          );
        });
        var newList = res.data.map((item) => {
          let duration = item.duration || 0;
          let minutes = Math.floor(duration / 60);
          let seconds = duration % 60;

          let avgPace = item.avgPace || 0;
          if (avgPace === 0 && item.distance > 0 && duration > 0) {
            avgPace = Math.round(duration / (item.distance / 1000));
            console.log(
              `计算配速: duration=${duration}, distance=${item.distance}, avgPace=${avgPace}`,
            );
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
        that.setData({
          recordList: newList,
        });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error(err);
      });
  },

  formatDateTime: function (timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  formatTime: function (s) {
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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
