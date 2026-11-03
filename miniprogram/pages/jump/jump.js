const jumpRopeDetector = require("../../utils/jumpRopeDetector.js");

const CALORIES_PER_JUMP = 0.3;
const BATCH_SIZE = 50;

// 加速度计回调频率，按优先级从高到低尝试。
// 个别机型 / 模拟器不接受 game 档，启动失败时自动降级重试。
const SENSOR_INTERVALS = ["game", "ui", "normal"];

Page({
  data: {
    isJumping: false,
    isCalculating: false,
    isSimulating: false,
    count: 0,
    timeStr: "00:00",
    speed: 0,
    calories: 0,
    maxContinuous: 0,
    tripCount: 0,
    debugInfo: [],
  },

  accelData: [],
  lastProcessedIndex: 0,
  startTimestamp: 0,
  timer: null,
  accelHandler: null,
  sensorStarted: false,
  lastSensorError: "",
  // 调试用：没有真实传感器时（模拟器/电脑/权限被拒）用模拟数据跑完整流程
  simulated: false,
  simTimer: null,
  dataWatchdog: null,
  // 加速度单位换算系数：微信返回 g（静止模长≈1），算法按 m/s²（静止≈9.8）设计
  unitScale: 0,
  unitMedian: 0,

  onLoad() {
    this.resetSession();
  },

  onUnload() {
    // 页面销毁时只释放传感器和计时器，避免在卸载过程中再发起云函数调用
    this.releaseSensor();
    this.stopTimer();
  },

  resetSession() {
    this.accelData = [];
    this.lastProcessedIndex = 0;
    this.startTimestamp = 0;
    this.sensorStarted = false;
    this.lastSensorError = "";
    this.unitScale = 0;
    this.unitMedian = 0;
    this.retriedPreOp = false;
  },

  async startJump() {
    if (this.data.isJumping || this.data.isCalculating || this.starting) {
      return;
    }
    this.starting = true;

    try {
      const app = getApp();
      const isLoggedIn = await app.verifyLogin();
      if (!isLoggedIn) {
        return;
      }

      if (
        typeof wx.startAccelerometer !== "function" ||
        typeof wx.onAccelerometerChange !== "function"
      ) {
        this.handleSensorError("当前运行环境不支持加速度计接口");
        return;
      }

      // 加速度计属于微信隐私接口：先读取隐私协议状态并触发授权
      // （未同意时会弹微信官方隐私弹窗；后台还需在《用户隐私保护指引》里声明“加速传感器”）
      this.privacyInfo = await this.getPrivacyInfo();
      await this.ensurePrivacyAuthorize();

      this.resetSession();

      this.setData({
        isJumping: true,
        isCalculating: false,
        isSimulating: false,
        count: 0,
        timeStr: "00:00",
        speed: 0,
        calories: 0,
        maxContinuous: 0,
        tripCount: 0,
        debugInfo: [
          "正在启动加速度计...",
          this.privacyText(),
        ].filter(Boolean),
      });

      this.startTimestamp = Date.now();

      // 清掉上一次可能残留的监听，避免重复回调或状态错乱
      if (typeof wx.offAccelerometerChange === "function") {
        wx.offAccelerometerChange();
      }

      // 先注册监听，再启动传感器，避免漏掉启动后的前几个数据点
      this.accelHandler = (res) => this.handleAccelSample(res);
      wx.onAccelerometerChange(this.accelHandler);

      this.startSensor(0);
    } finally {
      this.starting = false;
    }
  },

  /**
   * 读取隐私协议状态：privacyContractName 为空说明后台没配置隐私保护指引，
   * needAuthorization 为 true 说明用户还没同意隐私协议
   */
  getPrivacyInfo() {
    return new Promise((resolve) => {
      if (typeof wx.getPrivacySetting !== "function") {
        resolve(null);
        return;
      }
      wx.getPrivacySetting({
        success: (res) => resolve(res || null),
        fail: () => resolve(null),
      });
    });
  },

  /**
   * 触发隐私授权：用户未同意时微信会弹出官方隐私弹窗，同意后隐私接口才可用
   */
  ensurePrivacyAuthorize() {
    return new Promise((resolve) => {
      if (typeof wx.requirePrivacyAuthorize !== "function") {
        resolve();
        return;
      }
      wx.requirePrivacyAuthorize({
        success: () => resolve(),
        fail: (err) => {
          console.warn("隐私授权未通过:", err);
          resolve();
        },
      });
    });
  },

  privacyText() {
    if (this.privacyInfo === undefined) {
      return "";
    }
    if (!this.privacyInfo) {
      return "隐私状态: 当前基础库不支持 getPrivacySetting";
    }
    const name =
      this.privacyInfo.privacyContractName || "未配置《用户隐私保护指引》";
    const need = this.privacyInfo.needAuthorization ? "是" : "否";
    return `隐私协议: ${name} | 待授权: ${need}`;
  },

  /**
   * 统一处理一个加速度采样点（真机传感器和模拟数据共用）
   *
   * 注意单位：微信加速度计返回的是 g（静止时三轴模长≈1），
   * 而 jumpRopeDetector 里的 ENMO = 模长 - 9.8 是按 m/s² 设计的。
   * 如果不换算，模长 - 9.8 永远为负、被归零，波峰数就永远是 0。
   */
  handleAccelSample(res) {
    if (!this.data.isJumping) {
      return;
    }

    // 前 10 个点单位还没确定，先按原始值存，确定后统一换算
    const scale = this.unitScale || 1;
    this.accelData.push({
      x: res.x * scale,
      y: res.y * scale,
      z: res.z * scale,
      timestamp: Date.now() / 1000,
    });

    if (!this.unitScale && this.accelData.length >= 10) {
      this.applyUnitScale();
    }

    if (this.accelData.length - this.lastProcessedIndex >= BATCH_SIZE) {
      this.processPartial();
    }
  },

  /**
   * 用前 10 个采样点的模长中位数判断传感器单位：
   * 静止时模长约 1 → g（微信默认），约 9.8 → m/s²。
   * 判定为 g 时把已采集的数据统一乘 9.8，与算法保持一致。
   */
  applyUnitScale() {
    if (this.unitScale || this.accelData.length === 0) {
      return;
    }

    const sample = this.accelData.slice(0, 10);
    const mags = sample
      .map((d) => Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z))
      .sort((a, b) => a - b);
    const median = mags[Math.floor(mags.length / 2)] || 0;

    const scale = median > 0 && median < 4 ? 9.8 : 1;
    this.unitScale = scale;
    this.unitMedian = Math.round(median * 100) / 100;

    if (scale !== 1) {
      for (let i = 0; i < this.accelData.length; i++) {
        this.accelData[i].x *= scale;
        this.accelData[i].y *= scale;
        this.accelData[i].z *= scale;
      }
    }
  },

  /**
   * 逐级尝试不同的 interval 启动加速度计
   */
  startSensor(index) {
    if (index >= SENSOR_INTERVALS.length) {
      this.handleSensorError("加速度计启动失败", this.lastSensorError);
      return;
    }

    const interval = SENSOR_INTERVALS[index];

    // 微信要求先停掉上一次的加速度监听再启动，否则部分机型/调试环境会返回
    // "startAccelerometer:fail should stop pre operation"
    wx.stopAccelerometer({
      complete: () => {
        if (!this.data.isJumping) {
          return;
        }

        wx.startAccelerometer({
          interval,
          success: () => {
            // 启动回调可能晚于用户点击“结束”
            if (!this.data.isJumping) {
              wx.stopAccelerometer({});
              return;
            }

            this.sensorStarted = true;
            this.startTimer();
            this.startDataWatchdog();

            if (wx.setKeepScreenOn) {
              wx.setKeepScreenOn({ keepScreenOn: true });
            }

            this.setData({
              debugInfo: [`加速度计已启动（interval=${interval}）`].concat(
                this.data.debugInfo.slice(0, 6),
              ),
            });
          },
          fail: (err) => {
            const errMsg = (err && err.errMsg) || "未知错误";
            // 保留第一次失败的原因（通常最能说明问题）
            if (!this.lastSensorError) {
              this.lastSensorError = errMsg;
            }
            this.setData({
              debugInfo: [
                `startAccelerometer(${interval}) 失败: ${errMsg}`,
              ].concat(this.data.debugInfo.slice(0, 6)),
            });
            console.error(`wx.startAccelerometer(${interval}) 失败:`, err);

            // 用户已经结束本次跳绳时不再继续重试
            if (!this.data.isJumping) {
              return;
            }

            // "should stop pre operation" 不是频率问题：停掉后延迟重试同一档
            if (
              /pre[\s_-]*operation/i.test(errMsg) &&
              !this.retriedPreOp
            ) {
              this.retriedPreOp = true;
              setTimeout(() => {
                if (this.data.isJumping) {
                  this.startSensor(index);
                }
              }, 200);
              return;
            }

            this.startSensor(index + 1);
          },
        });
      },
    });
  },

  startTimer() {
    this.stopTimer();

    this.timer = setInterval(() => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - this.startTimestamp) / 1000),
      );
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      this.setData({
        timeStr: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      });
    }, 500);
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  /**
   * 释放传感器：移除监听 + 停止采集 + 恢复屏幕常亮设置
   */
  releaseSensor() {
    this.clearDataWatchdog();
    this.stopSimulation();

    if (this.accelHandler) {
      try {
        wx.offAccelerometerChange(this.accelHandler);
      } catch (e) {
        // 部分基础库只支持不传参数移除全部监听
        wx.offAccelerometerChange();
      }
      this.accelHandler = null;
    }

    if (this.sensorStarted) {
      wx.stopAccelerometer({
        success: () => console.log("加速度计已停止"),
        fail: (err) => console.error("加速度计停止失败:", err),
      });
      this.sensorStarted = false;
    }

    if (wx.setKeepScreenOn) {
      wx.setKeepScreenOn({ keepScreenOn: false });
    }
  },

  /**
   * 启动后 3 秒仍收不到任何数据，说明当前环境没有可用的加速度传感器
   * （典型场景：微信开发者工具模拟器、电脑版微信、iOS 关闭了“运动与健身”）
   */
  startDataWatchdog() {
    this.clearDataWatchdog();
    this.dataWatchdog = setTimeout(() => {
      this.dataWatchdog = null;
      if (!this.data.isJumping || this.simulated || this.accelData.length > 0) {
        return;
      }

      wx.showModal({
        title: "没有收到加速度数据",
        content:
          "加速度计已启动，但 3 秒内没有收到任何数据，当前环境可能没有可用的传感器。\n\n可以先使用模拟数据走完 计数-算法-保存 的完整流程。",
        confirmText: "使用模拟数据",
        cancelText: "再等等",
        success: (res) => {
          if (res.confirm) {
            this.startSimulation();
          }
        },
      });
    }, 3000);
  },

  clearDataWatchdog() {
    if (this.dataWatchdog) {
      clearTimeout(this.dataWatchdog);
      this.dataWatchdog = null;
    }
  },

  /**
   * 调试用：用 50Hz 的模拟跳绳波形（每秒 2 次）驱动同一套采集 / 算法 / 保存流程
   */
  async startSimulation() {
    const app = getApp();
    const isLoggedIn = await app.verifyLogin();
    if (!isLoggedIn) {
      return;
    }

    this.releaseSensor();
    this.stopTimer();

    this.simulated = true;
    this.accelData = [];
    this.lastProcessedIndex = 0;
    this.unitScale = 0;
    this.unitMedian = 0;
    this.startTimestamp = Date.now();

    this.setData({
      isJumping: true,
      isCalculating: false,
      isSimulating: true,
      count: 0,
      timeStr: "00:00",
      speed: 0,
      calories: 0,
      maxContinuous: 0,
      tripCount: 0,
      debugInfo: [
        "【模拟数据】未检测到可用加速度计，使用模拟跳绳数据演示",
        "模拟参数：50Hz 采样，每秒 2 次跳跃",
      ],
    });

    this.startTimer();

    if (wx.setKeepScreenOn) {
      wx.setKeepScreenOn({ keepScreenOn: true });
    }

    const STEP_MS = 20;
    this.simTimer = setInterval(() => {
      const t = (Date.now() - this.startTimestamp) / 1000;
      const phase = 2 * Math.PI * 2 * t;
      // 模拟数据同样使用微信的单位 g（静止模长≈1），走和真机一样的单位换算
      this.handleAccelSample({
        x: (Math.random() - 0.5) * 0.1,
        y: (Math.random() - 0.5) * 0.1,
        z: 1 + 0.4 * Math.sin(phase),
      });
    }, STEP_MS);
  },

  stopSimulation() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    this.simulated = false;

    if (this.data.isSimulating) {
      this.setData({ isSimulating: false });
    }
  },

  /**
   * 每次累积到 BATCH_SIZE 个点，用算法处理全部已采集数据并刷新界面
   */
  processPartial() {
    const newPoints = this.accelData.length - this.lastProcessedIndex;
    this.lastProcessedIndex = this.accelData.length;

    let result;
    try {
      result = jumpRopeDetector(this.accelData);
    } catch (e) {
      console.error("跳绳算法处理失败:", e);
      this.setData({
        debugInfo: [`算法异常: ${e.message || e}`].concat(
          this.data.debugInfo.slice(0, 6),
        ),
      });
      return;
    }

    const calories = Math.round(result.count * CALORIES_PER_JUMP);
    const sampleRate = this.estimateSampleRate();
    const tag = this.simulated ? "【模拟】" : "";
    const unitText =
      this.unitScale === 9.8
        ? `g（原始模长 ${this.unitMedian}，已换算 m/s²）`
        : `m/s²（原始模长 ${this.unitMedian}）`;
    const debugInfo = [
      `${tag}数据点: ${this.accelData.length}（本批 +${newPoints}）`,
      `${tag}采样率: ${sampleRate} Hz | 单位: ${unitText}`,
      `总次数: ${result.count} | 速度: ${result.avgSpeed} 次/分`,
      `最高连跳: ${result.maxContinuous} | 绊绳: ${result.tripCount}`,
    ];

    if (sampleRate > 0 && sampleRate < 15) {
      debugInfo.push("采样率过低（算法要求 ≥15Hz），无法识别跳绳");
    }

    this.setData({
      count: result.count,
      speed: result.avgSpeed,
      maxContinuous: result.maxContinuous,
      tripCount: result.tripCount,
      calories: calories,
      debugInfo: debugInfo.concat(this.data.debugInfo.slice(0, 6)),
    });
  },

  /**
   * 用最近 100 个点估算实际采样率（Hz），用于判断传感器是否真的在回调
   */
  estimateSampleRate() {
    const total = this.accelData.length;
    if (total < 2) return 0;

    const start = Math.max(0, total - 101);
    const dt =
      this.accelData[total - 1].timestamp - this.accelData[start].timestamp;
    if (dt <= 0) return 0;

    return Math.round(((total - 1 - start) / dt) * 10) / 10;
  },

  stopJump() {
    if (!this.data.isJumping && !this.sensorStarted) {
      return;
    }

    const wasSimulated = this.simulated;

    this.releaseSensor();
    this.stopTimer();

    const endTime = Date.now();
    const duration = Math.max(
      0,
      Math.round((endTime - this.startTimestamp) / 1000),
    );

    this.setData({
      isJumping: false,
      isCalculating: true,
      debugInfo: [
        `=== 已结束采集 ===`,
        `数据点: ${this.accelData.length}`,
        `时长: ${duration}s`,
      ].concat(this.data.debugInfo),
    });

    // 先让界面切到“计算中”，再用完整数据跑一次算法
    setTimeout(() => this.finishJump(duration, wasSimulated), 50);
  },

  finishJump(duration, wasSimulated) {
    let result = {
      count: 0,
      avgSpeed: 0,
      maxContinuous: 0,
      tripCount: 0,
      confidence: 0,
    };

    try {
      // 数据点不足 10 个时单位可能还没换算，这里补一次
      this.applyUnitScale();
      result = jumpRopeDetector(this.accelData);
    } catch (e) {
      console.error("跳绳算法处理失败:", e);
    }

    const calories = Math.round(result.count * CALORIES_PER_JUMP);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    this.setData({
      count: result.count,
      speed: result.avgSpeed,
      maxContinuous: result.maxContinuous,
      tripCount: result.tripCount,
      calories: calories,
      timeStr: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      isCalculating: false,
      debugInfo: [
        wasSimulated ? "=== 最终结果（模拟数据）===" : "=== 最终结果 ===",
        `总次数: ${result.count} | 时长: ${duration}s`,
        `平均速度: ${result.avgSpeed} 次/分`,
        `最高连跳: ${result.maxContinuous} | 绊绳: ${result.tripCount}`,
        `置信度: ${result.confidence} | 卡路里: ${calories}`,
      ].concat(this.data.debugInfo),
    });

    // 没有识别到有效跳绳时不保存，避免云函数返回“次数必须大于0”的失败提示
    if (result.count <= 0) {
      wx.showToast({ title: "未检测到有效跳绳", icon: "none" });
      return;
    }

    this.saveRecord({
      count: result.count,
      duration: duration,
      avgSpeed: result.avgSpeed,
      maxContinuous: result.maxContinuous,
      tripCount: result.tripCount,
    });
  },

  /**
   * 加速度计不可用时的统一处理：清场 + 在页面和弹窗里给出可操作的原因
   */
  handleSensorError(message, detail) {
    this.releaseSensor();
    this.stopTimer();

    const errText = String(detail || "");
    const device = this.getDeviceInfo();
    const platform = String(device.platform || "").toLowerCase();
    const hints = [];

    // 隐私协议问题（最常见：后台没声明“加速传感器”，或用户没同意隐私协议）
    const isPrivacyIssue = /privacy|scope|declared/i.test(errText);
    if (isPrivacyIssue) {
      hints.push(
        "微信返回的是隐私协议问题：请到 小程序后台 → 设置 → 服务内容声明 → 用户隐私保护指引 中勾选“加速传感器”，提交后在隐私弹窗里点同意",
      );
    }

    // 上一次传感器操作还没停（should stop pre operation）
    const isPreOperationIssue = /pre[\s_-]*operation|operate too frequent/i.test(
      errText,
    );
    if (isPreOperationIssue) {
      hints.push(
        "微信提示要先停止上一次传感器操作：代码已在启动前自动 stop，若仍出现请彻底退出小程序（或杀掉微信）后重进再试",
      );
    }

    if (
      platform === "devtools" ||
      platform === "windows" ||
      platform === "mac"
    ) {
      hints.push(
        `当前运行环境是 ${platform}，电脑/模拟器没有真实的加速度传感器`,
      );
    } else if (!isPrivacyIssue && !isPreOperationIssue) {
      hints.push("iPhone：设置 → 隐私与安全性 → 运动与健身 → 打开“微信”");
      hints.push(
        "国行 iOS 26/27 新增的“限制运动数据 / 禁止摇一摇跳转”也会屏蔽加速度计，请一并检查",
      );
      hints.push("Android：在系统设置中允许微信访问“身体传感器/运动数据”");
    }
    if (
      !isPrivacyIssue &&
      !isPreOperationIssue &&
      /auth|denied|permission/i.test(errText)
    ) {
      hints.unshift("系统返回的是“权限被拒绝”，请优先按下面的权限步骤处理");
    }

    const detailText = detail ? `（${detail}）` : "";
    const deviceText = [device.platform, device.model, device.system]
      .filter(Boolean)
      .join(" / ");

    this.setData({
      isJumping: false,
      isCalculating: false,
      debugInfo: [
        `${message}${detailText}`,
        deviceText ? `设备: ${deviceText}` : "",
        this.privacyText(),
      ]
        .filter(Boolean)
        .concat(hints, this.data.debugInfo),
    });

    wx.showModal({
      title: "加速度计不可用",
      content: `${message}${detailText}${deviceText ? `\n设备：${deviceText}` : ""}\n${this.privacyText()}\n\n${hints.join("\n")}\n\n也可以先用模拟数据检查算法和保存流程。`,
      confirmText: "使用模拟数据",
      cancelText: "知道了",
      success: (res) => {
        if (res.confirm) {
          this.startSimulation();
        }
      },
    });
  },

  getDeviceInfo() {
    try {
      return wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync();
    } catch (e) {
      return {};
    }
  },

  saveRecord(record) {
    wx.showLoading({ title: "保存中..." });
    wx.cloud
      .callFunction({
        name: "save-jump-record",
        data: record,
      })
      .then((res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: "保存成功", icon: "success" });
        } else {
          const msg = (res.result && res.result.message) || "保存失败";
          this.showSaveError(msg);
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("保存跳绳记录失败:", err);
        const code = err && err.errCode ? `[${err.errCode}] ` : "";
        const msg =
          "云函数调用失败：" +
          code +
          ((err && (err.errMsg || err.message)) || "请重试");
        this.showSaveError(msg);
      });
  },

  /**
   * 保存失败时用弹窗展示完整原因（toast 太短看不清），并给出对应处理建议
   */
  showSaveError(message) {
    const tip = this.buildSaveErrorTip(message);
    this.setData({
      debugInfo: [`保存失败: ${message}`].concat(this.data.debugInfo.slice(0, 6)),
    });
    wx.showModal({
      title: "保存失败",
      content: message + (tip ? `\n\n${tip}` : ""),
      showCancel: false,
      confirmText: "知道了",
    });
  },

  buildSaveErrorTip(message) {
    const text = String(message || "");
    if (/collection not exists|集合不存在/i.test(text)) {
      return "数据库还没有 jump_records 集合：请在 云开发控制台 → 数据库 新建集合 jump_records（权限选“仅创建者可读写”）。";
    }
    if (/Cannot find module|MODULE_NOT_FOUND/i.test(text)) {
      return "云函数依赖没装上：重新部署 save-jump-record，并选择“云端安装依赖（不上传 node_modules）”。";
    }
    if (/timeout|超时|ETIMEDOUT/i.test(text)) {
      return "云函数执行超时：到 云开发控制台 → 云函数 → 版本与配置，把超时时间调大到 20 秒后重试。";
    }
    if (/privacy|scope|declared/i.test(text)) {
      return "隐私协议问题：请在小程序后台的《用户隐私保护指引》里声明对应能力。";
    }
    return "可以把这段文字发给我，我按具体错误继续修。";
  },

  toggleJump() {
    if (this.data.isJumping) {
      this.stopJump();
    } else {
      this.startJump();
    }
  },
});
