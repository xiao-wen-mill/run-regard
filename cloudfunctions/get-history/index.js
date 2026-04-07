const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 可选分页参数，默认取最近 20 条
  const { page = 1, pageSize = 20 } = event
  const skip = (page - 1) * pageSize

  // 查询当前用户的所有跑步记录，按时间倒序
  const result = await db.collection('run_records')
    .where({ openid: openid })
    .orderBy('createTime', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  // 获取总数（用于分页）
  const total = await db.collection('run_records')
    .where({ openid: openid })
    .count()

  return {
    success: true,
    data: result.data,
    total: total.total,
    page: page,
    pageSize: pageSize,
    hasMore: skip + result.data.length < total.total
  }
}