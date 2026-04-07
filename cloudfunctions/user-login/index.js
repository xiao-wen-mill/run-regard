const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 前端可以传用户信息（昵称、头像）
  const { nickName, avatarUrl } = event
  
  const usersCollection = db.collection('users')
  
  // 查询用户是否存在
  const existUser = await usersCollection.where({
    openid: openid
  }).get()
  
  // 如果用户不存在，创建新用户
  if (existUser.data.length === 0) {
    await usersCollection.add({
      data: {
        openid: openid,
        nickName: nickName || '微信用户',
        avatarUrl: avatarUrl || '',
        createTime: new Date(),
        totalRunCount: 0,
        totalDistance: 0
      }
    })
    
    return {
      success: true,
      isNewUser: true,
      message: '用户创建成功'
    }
  }
  
  // 用户已存在，返回用户信息
  return {
    success: true,
    isNewUser: false,
    userInfo: existUser.data[0],
    message: '登录成功'
  }
}