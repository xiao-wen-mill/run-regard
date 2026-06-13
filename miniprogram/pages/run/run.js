Page({
  data: {
    isRunning: false,
    isPaused: false,
    time: 0,
    timeStr: "00:00:00",
    distance: 0,
    distanceKm: "0.00",
    speed: 0,
    paceStr: "00:00",
    calories: 0,
    startTime: null,
    startTimestamp: 0,
    gpsPoints: [],
    lastLat: 0,
    lastLng: 0,
  },

  timer: null,
  locationWatch: null,
  pausedTime: 0,
  pauseStartTime: 0,
  totalPausedTime: 0,
  lastUpdateTime: 0,

  onLoad() {
    this.requestLocationPermission();
  },

  requestLocationPermission() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting["scope.userLocation"]) {
          wx.authorize({
            scope: "scope.userLocation",
            success: () => {
              console.log("定位授权成功");
            },
            fail: () => {
              wx.showToast({
                title: "请开启定位权限",
                icon: "none",
              });
            },
          });
        }
      },
    });
  },

  async startRun() {
    const app = getApp();
    const isLoggedIn = await app.verifyLogin();
    if (!isLoggedIn) {
      return;
    }

    this.setData({
      isRunning: true,
      isPaused: false,
      time: 0,
      timeStr: "00:00:00",
      distance: 0,
      distanceKm: "0.00",
      speed: 0,
      paceStr: "00:00",
      calories: 0,
      startTime: new Date().toISOString(),
      startTimestamp: Date.now(),
      gpsPoints: [],
      lastLat: 0,
      lastLng: 0,
    });

    this.pauseStartTime = 0;
    this.totalPausedTime = 0;

    // 请求后台定位权限
    this.requestBackgroundLocationPermission();

    // 使用后台持续定位，确保后台也能获取位置更新
    wx.startLocationUpdateBackground({ type: "gcj02" });

    this.timer = setInterval(() => {
      if (!this.data.isPaused) {
        // 使用时间戳差值计算实际运行时间
        const elapsed = Math.floor(
          (Date.now() - this.data.startTimestamp - this.totalPausedTime) / 1000,
        );
        this.setData({ time: elapsed });
        const h = Math.floor(elapsed / 3600);
        const m = Math.floor((elapsed % 3600) / 60);
        const s = elapsed % 60;
        this.setData({
          timeStr: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        });
        this.calcRealTimeData();
      }
    }, 1000);

    this.locationWatch = wx.onLocationChange((res) => {
      if (this.data.isPaused) return;

      const point = {
        latitude: res.latitude,
        longitude: res.longitude,
        timestamp: Date.now(),
      };

      // 更新时间（使用位置回调来校准时间，避免定时器暂停问题）
      const elapsed = Math.floor(
        (point.timestamp - this.data.startTimestamp - this.totalPausedTime) / 1000,
      );
      this.setData({ time: elapsed });
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      this.setData({
        timeStr: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      });

      this.setData({
        gpsPoints: [...this.data.gpsPoints, point],
      });

      if (this.data.lastLat && this.data.lastLng) {
        const dis = this.getDistance(
          this.data.lastLat,
          this.data.lastLng,
          res.latitude,
          res.longitude,
        );
        const timeDiff =
          point.timestamp -
          (this.data.gpsPoints[this.data.gpsPoints.length - 2]?.timestamp ||
            point.timestamp);
        const speed = dis / (timeDiff / 1000);
        // 放宽速度限制，允许更高的瞬时速度
        if (speed <= 15) {
          const newDis = this.data.distance + dis;
          this.setData({
            distance: newDis,
            distanceKm: (newDis / 1000).toFixed(2),
          });
        }
      }
      this.setData({ lastLat: res.latitude, lastLng: res.longitude });
      this.calcRealTimeData();
    });
  },

  requestBackgroundLocationPermission() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting["scope.userLocationBackground"]) {
          wx.authorize({
            scope: "scope.userLocationBackground",
            success: () => {
              console.log("后台定位授权成功");
            },
            fail: () => {
              wx.showToast({
                title: "请开启后台定位权限",
                icon: "none",
              });
            },
          });
        }
      },
    });
  },

  togglePause() {
    this.setData({ isPaused: !this.data.isPaused });
    if (this.data.isPaused) {
      // 记录暂停开始时间
      this.pauseStartTime = Date.now();
      wx.pauseLocationUpdate();
    } else {
      // 累计暂停时间
      this.totalPausedTime += Date.now() - this.pauseStartTime;
      this.pauseStartTime = 0;
      wx.startLocationUpdateBackground({ type: "gcj02" });
    }
  },

  calcRealTimeData() {
    const durationMin = this.data.time / 60;
    const distanceKm = this.data.distance / 1000;
    let paceStr = "00:00";
    let calories = 0;
    const weight = 60;

    if (distanceKm > 0) {
      const paceMin = durationMin / distanceKm;
      const pMin = Math.floor(paceMin);
      const pSec = Math.round((paceMin - pMin) * 60);
      paceStr = `${String(pMin).padStart(2, "0")}:${String(pSec).padStart(2, "0")}`;
    }

    calories = Math.round(weight * distanceKm * 1.036);
    this.setData({ paceStr, calories });
  },

  async stopRun() {
    const app = getApp();
    const isLoggedIn = await app.verifyLogin();
    if (!isLoggedIn) {
      return;
    }

    clearInterval(this.timer);
    wx.offLocationChange(this.locationWatch);
    wx.stopLocationUpdate();
    this.setData({ isRunning: false });

    // 停止后再次校准时间，确保时间准确
    const elapsed = Math.floor(
      (Date.now() - this.data.startTimestamp - this.totalPausedTime) / 1000,
    );
    this.setData({ time: elapsed });
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    this.setData({
      timeStr: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    });

    const endTime = new Date().toISOString();

    wx.cloud
      .callFunction({
        name: "saveRunRecord",
        data: {
          duration: this.data.time,
          distance: Math.round(this.data.distance),
          calories: this.data.calories,
          avgPace: this.data.paceStr,
          startTime: this.data.startTime,
          endTime: endTime,
          gpsPoints: this.data.gpsPoints,
        },
      })
      .then((res) => {
        wx.showToast({ title: "保存成功" });
      })
      .catch((err) => {
        wx.showToast({ title: "保存失败", icon: "none" });
      });
  },

  getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  },
});