Page({
  data: {
    nickName: "",
    gender: "",
    age: "",
    height: "",
    weight: "",
    isChecked: false,
    isEditMode: false,
    userId: "",
  },

  async onLoad() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    if (userInfo && userInfo.nickName) {
      try {
        const db = wx.cloud.database();
        const res = await db.collection("users").get();
        if (res.data.length > 0) {
          const fullUser = res.data[0];
          this.setData({
            isEditMode: true,
            userId: fullUser._id,
            nickName: fullUser.nickName || "",
            gender: fullUser.gender || "",
            age:
              fullUser.age !== undefined &&
                fullUser.age !== null &&
                fullUser.age !== 0
                ? String(fullUser.age)
                : "",
            height:
              fullUser.height !== undefined &&
                fullUser.height !== null &&
                fullUser.height !== 0
                ? String(fullUser.height)
                : "",
            weight:
              fullUser.weight !== undefined &&
                fullUser.weight !== null &&
                fullUser.weight !== 0
                ? String(fullUser.weight)
                : "",
            isChecked: true,
          });
          wx.setNavigationBarTitle({ title: "编辑个人资料" });
        }
      } catch (err) {
        console.error("获取用户信息失败:", err);
      }
    }
  },

  onNickInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ gender: e.detail.value });
  },

  onAgeInput(e) {
    this.setData({ age: e.detail.value });
  },

  onHeightInput(e) {
    this.setData({ height: e.detail.value });
  },

  onWeightInput(e) {
    this.setData({ weight: e.detail.value });
  },

  toggleCheck() {
    this.setData({ isChecked: !this.data.isChecked });
  },

  async handleRegister() {
    const { nickName, gender, age, height, weight, isChecked, isEditMode } =
      this.data;

    if (!nickName) {
      return wx.showToast({ title: "请输入昵称", icon: "none" });
    }
    if (!gender) {
      return wx.showToast({ title: "请选择性别", icon: "none" });
    }
    if (!age) {
      return wx.showToast({ title: "请输入年龄", icon: "none" });
    }
    if (!height) {
      return wx.showToast({ title: "请输入身高", icon: "none" });
    }
    if (!weight) {
      return wx.showToast({ title: "请输入体重", icon: "none" });
    }
    if (!isChecked) {
      return wx.showToast({ title: "请先勾选授权信息", icon: "none" });
    }

    wx.showLoading({ title: isEditMode ? "保存中..." : "注册中..." });
    try {
      const app = getApp();

      if (isEditMode) {
        const res = await wx.cloud.callFunction({
          name: "updateUserInfo",
          data: {
            nickName: nickName,
            gender: gender,
            age: Number(age),
            height: Number(height),
            weight: Number(weight),
          },
        });

        wx.hideLoading();
        if (res.result.success) {
          app.globalData.userInfo = res.result.userInfo;
          wx.showToast({ title: "资料已更新" });
          setTimeout(() => wx.navigateBack(), 1000);
        } else {
          wx.showToast({
            title: res.result.message || "保存失败",
            icon: "none",
          });
        }
      } else {
        const res = await wx.cloud.callFunction({
          name: "register",
          data: {
            nickName: nickName,
            avatarUrl: "",
            gender: gender,
            age: Number(age),
            height: Number(height),
            weight: Number(weight),
          },
        });

        wx.hideLoading();
        if (res.result.success) {
          wx.showToast({ title: "注册成功！请登录..." });
          setTimeout(() => wx.redirectTo({ url: "/pages/login/login" }), 1200);
        } else {
          wx.showToast({
            title: res.result.message || "注册失败",
            icon: "none",
          });
        }
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: isEditMode ? "保存失败" : "注册失败",
        icon: "error",
      });
      console.error("操作错误：", err);
    }
  },
});