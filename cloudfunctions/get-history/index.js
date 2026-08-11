const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { page = 1, pageSize = 20 } = event
  const skip = (page - 1) * pageSize

  const result = await db.collection('run_records')
    .where({ openid: openid })
    .orderBy('createTime', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  const total = await db.collection('run_records')
    .where({ openid: openid })
    .count()

  const aggResult = await db.collection('run_records')
    .where({ openid: openid })
    .aggregate()
    .group({
      _id: null,
      totalDistance: _.sum('$distance'),
      totalDuration: _.sum('$duration'),
      totalRecords: _.sum(1),
    })
    .end()

  const aggregates = aggResult.list[0] || { totalDistance: 0, totalDuration: 0, totalRecords: 0 }

  return {
    success: true,
    data: result.data,
    total: total.total,
    page: page,
    pageSize: pageSize,
    hasMore: skip + result.data.length < total.total,
    stats: {
      totalDistance: aggregates.totalDistance || 0,
      totalDuration: aggregates.totalDuration || 0,
      totalRunCount: aggregates.totalRecords || 0,
    }
  }
}