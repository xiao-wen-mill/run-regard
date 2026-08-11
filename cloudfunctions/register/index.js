const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { nickName, avatarUrl, gender, age, height, weight } = event;

  const exist = await db.collection("users").where({ openid }).get();

  if (exist.data.length > 0) {
    const userRecord = exist.data[0];
    const updateData = {};
    if (nickName !== undefined) updateData.nickName = nickName;
    if (gender !== undefined) updateData.gender = gender;
    if (age !== undefined) updateData.age = age;
    if (height !== undefined) updateData.height = height;
    if (weight !== undefined) updateData.weight = weight;
    if (avatarUrl !== undefined && avatarUrl) updateData.avatarUrl = avatarUrl;

    await db.collection("users").doc(userRecord._id).update({
      data: updateData,
    });
    return { success: true, message: "资料更新成功", isUpdate: true };
  }

  await db.collection("users").add({
    data: {
      openid,
      nickName: nickName || "微信用户",
      avatarUrl: avatarUrl || "",
      gender: gender || "",
      age: age || 0,
      height: height || 0,
      weight: weight || 60,
      avgStride: 0.85,
      createTime: new Date(),
      totalRunCount: 0,
      totalDistance: 0,
    },
  });
  return { success: true, message: "注册成功", isUpdate: false };
};
