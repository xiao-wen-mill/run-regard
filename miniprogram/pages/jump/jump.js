Page({
  data: {
    isJumping: false,
    isCalculating: false,
    count: 0,
    timeStr: "00:00",
    speed: 0,
    calories: 0,
    debugInfo: [],
  },

  timer: null,
  startTimestamp: 0,
  lastAccelData: null,
  peakIntervals: [],
  lastPeakTime: 0,

  onLoad() {
    this.accelHandler = null;
  },

  onUnload() {
    if (this.data.isJumping) {
      this.stopJump();
    }
  },

  startJump() {
    this.setData({
      isJumping: true,
      isCalculating: false,
      count: 0,
      timeStr: "00:00",
      speed: 0,
      calories: 0,
      debugInfo: [],
    });

    this.startTimestamp = Date.now();
    this.peakIntervals = [];
    this.lastPeakTime = 0;
    this.lastAccelData = null;

    wx.startAccelerometer({
      interval: "game",
      success: () => {
        console.log("加速度计启动成功，频率: game (~20ms)");
      },
      fail: (err) => {
        console.error("加速度计启动失败:", err);
        wx.showToast({ title: "加速度计启动失败", icon: "none" });
        this.setData({ isJumping: false });
        return;
      },
    });

    this.accelHandler = (res) => {
      const { x, y, z } = res;
      const now = Date.now();
      const totalAccel = Math.sqrt(x * x + y * y + z * z);

      console.log("accel:", { x, y, z, total: totalAccel.toFixed(3) });

      if (this.lastAccelData) {
        const dt = now - this.lastAccelData.time;
        const delta = totalAccel - this.lastAccelData.total;

        if (
          this.lastAccelData.delta > 0 &&
          delta <= 0 &&
          this.lastAccelData.total > 2.5
        ) {
          if (this.lastPeakTime > 0) {
            const interval = now - this.lastPeakTime;
            this.peakIntervals.push(interval);
            if (this.peakIntervals.length > 20) {
              this.peakIntervals.shift();
            }

            const avgInterval =
              this.peakIntervals.reduce((a, b) => a + b, 0) /
              this.peakIntervals.length;
            const currentSpeed = Math.round(60000 / avgInterval);
            const newCount = this.data.count + 1;

            this.setData({
              count: newCount,
              speed: currentSpeed,
              debugInfo: [
                `波峰间隔: ${interval}ms`,
                `平均间隔: ${avgInterval.toFixed(0)}ms`,
                `速度: ${currentSpeed} 次/分`,
                `波峰数: ${newCount}`,
              ].concat(this.data.debugInfo.slice(0, 6)),
            });
          }
          this.lastPeakTime = now;
        }

        this.lastAccelData = {
          x,
          y,
          z,
          total: totalAccel,
          delta,
          time: now,
        };
      } else {
        this.lastAccelData = {
          x,
          y,
          z,
          total: totalAccel,
          delta: 0,
          time: now,
        };
      }
    };

    wx.onAccelerometerChange(this.accelHandler);

    this.timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTimestamp) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      this.setData({
        timeStr: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      });
    }, 500);
  },

  stopJump() {
    wx.offAccelerometerChange();
    wx.stopAccelerometer({
      success: () => console.log("加速度计已停止"),
      fail: (err) => console.error("加速度计停止失败:", err),
    });

    if (this.accelHandler) {
      wx.offAccelerometerChange(this.accelHandler);
      this.accelHandler = null;
    }

    clearInterval(this.timer);
    this.setData({ isJumping: false, isCalculating: true });

    setTimeout(() => {
      const mockCalories = Math.round(this.data.count * 0.3);
      this.setData({
        calories: mockCalories,
        isCalculating: false,
        debugInfo: [
          `=== 运动结束 ===`,
          `总次数: ${this.data.count}`,
          `总时长: ${this.data.timeStr}`,
          `平均速度: ${this.data.speed} 次/分`,
          `预估卡路里: ${mockCalories}`,
        ].concat(this.data.debugInfo.slice(0, 3)),
      });
      wx.showToast({ title: "完成!" });
    }, 800);
  },

  toggleJump() {
    if (this.data.isJumping) {
      this.stopJump();
    } else {
      this.startJump();
    }
  },
});
