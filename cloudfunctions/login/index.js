const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length > 0) {
    return {
      success: true,
      userInfo: userRes.data[0]
    }
  } else {
    return {
      success: false,
      message: '用户未注册'
    }
  }
}