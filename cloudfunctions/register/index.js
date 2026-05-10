const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { nickName, avatarUrl } = event

  const exist = await db.collection('users').where({ openid }).get()
  if (exist.data.length > 0) {
    return { success: false, message: '用户已注册' }
  }

  await db.collection('users').add({
    data: {
      openid,
      nickName: nickName || '微信用户',
      avatarUrl: avatarUrl || '',
      weight: 60,              // 体重（公斤），默认60kg
      avgStride: 0.85,         // 平均步幅（米），默认0.85米
      createTime: new Date(),
      totalRunCount: 0,
      totalDistance: 0
    }
  })
  return { success: true, message: '注册成功' }
}