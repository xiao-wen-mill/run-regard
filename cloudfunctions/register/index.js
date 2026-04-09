const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const userRes = await db.collection('users').where({ openid }).get()
  return {
    success: true,
    isRegistered: userRes.data.length > 0,
    userInfo: userRes.data[0] || null
  }
}