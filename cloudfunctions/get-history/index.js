const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function isCollectionMissing(err) {
  const msg = (err && (err.errMsg || err.message)) || "";
  return (
    (err && err.errCode === -502005) ||
    /collection not exists|集合不存在/i.test(msg)
  );
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const type = event.type || "run";
  const { page = 1, pageSize = 20 } = event;
  const skip = (page - 1) * pageSize;

  try {
    if (type === "jump") {
      const result = await db
        .collection("jump_records")
        .where({ openid: openid })
        .orderBy("createTime", "desc")
        .skip(skip)
        .limit(pageSize)
        .get();

      const total = await db
        .collection("jump_records")
        .where({ openid: openid })
        .count();

      return {
        success: true,
        data: result.data,
        total: total.total,
        page: page,
        pageSize: pageSize,
        hasMore: skip + result.data.length < total.total,
        stats: {
          totalJumpRecords: total.total,
        },
      };
    }

    const result = await db
      .collection("run_records")
      .where({ openid: openid })
      .orderBy("createTime", "desc")
      .skip(skip)
      .limit(pageSize)
      .get();

    const total = await db
      .collection("run_records")
      .where({ openid: openid })
      .count();

    return {
      success: true,
      data: result.data,
      total: total.total,
      page: page,
      pageSize: pageSize,
      hasMore: skip + result.data.length < total.total,
      stats: {
        totalRunRecords: total.total,
      },
    };
  } catch (err) {
    console.error("get-history 查询失败", err);

    // 集合还没创建（例如还没保存过跳绳记录）时返回空列表，不要报错
    if (isCollectionMissing(err)) {
      return {
        success: true,
        data: [],
        total: 0,
        page: page,
        pageSize: pageSize,
        hasMore: false,
        stats: {},
        needInit: true,
      };
    }

    return {
      success: false,
      data: [],
      total: 0,
      page: page,
      pageSize: pageSize,
      hasMore: false,
      message: (err && (err.errMsg || err.message)) || "查询失败",
    };
  }
};
