const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 查询用户是否存在
  const userRes = await db.collection('users').where({ openid }).get()

  // 如果不存在，返回未注册
  if (userRes.data.length === 0) {
    return { success: false, message: '用户未注册' }
  }

  // 如果存在，返回用户信息（不返回 openid）
  const user = userRes.data[0]
  return {
    success: true,
    userInfo: {
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      totalRunCount: user.totalRunCount,
      totalDistance: user.totalDistance
    }
  }
}