const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  // 接收前端传来的数据
  const { duration, distance, calories } = event
  
  // 获取用户 openid
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 参数校验
  if (!duration || !distance) {
    return {
      success: false,
      message: '跑步时长和距离不能为空'
    }
  }

  try {
    // 1. 存入跑步记录
    const res = await db.collection('run_records').add({
      data: {
        openid: openid,
        duration: Number(duration),
        distance: Number(distance),
        calories: Number(calories) || 0,
        createTime: new Date()
      }
    })

    // 2. 更新用户的统计数据（总次数、总距离）
    const usersCollection = db.collection('users')
    const userResult = await usersCollection.where({ openid: openid }).get()
    
    if (userResult.data.length > 0) {
      const user = userResult.data[0]
      await usersCollection.doc(user._id).update({
        data: {
          totalRunCount: (user.totalRunCount || 0) + 1,
          totalDistance: (user.totalDistance || 0) + Number(distance)
        }
      })
    }

    return {
      success: true,
      message: '记录保存成功',
      recordId: res._id
    }
  } catch (err) {
    console.error('保存失败', err)
    return {
      success: false,
      message: '保存失败，请重试'
    }
  }
}