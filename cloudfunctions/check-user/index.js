const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const userRes = await db.collection('users').where({ openid }).get()

  if (userRes.data.length === 0) {
    return {
      success: true,
      isRegistered: false,
      userInfo: null,
    }
  }

  const user = userRes.data[0]
  return {
    success: true,
    isRegistered: true,
    userInfo: {
      nickName: user.nickName || '',
      avatarUrl: user.avatarUrl || '',
      gender: user.gender || '',
      age: user.age || 0,
      height: user.height || 0,
      weight: user.weight || 0,
      totalRunCount: user.totalRunCount || 0,
      totalDistance: user.totalDistance || 0,
      totalJumpCount: user.totalJumpCount || 0,
    },
  }
}