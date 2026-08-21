const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { count, duration, avgSpeed, maxContinuous, tripCount } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!count || count <= 0) {
    return {
      success: false,
      message: '跳绳次数必须大于0'
    }
  }

  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) {
      return { success: false, message: '用户不存在' }
    }

    const userId = userRes.data[0]._id

    const res = await db.collection('jump_records').add({
      data: {
        openid,
        count: Number(count),
        duration: Number(duration) || 0,
        avgSpeed: Number(avgSpeed) || 0,
        maxContinuous: Number(maxContinuous) || 0,
        tripCount: Number(tripCount) || 0,
        createTime: new Date()
      }
    })

    await db.collection('users').doc(userId).update({
      data: {
        totalJumpCount: (userRes.data[0].totalJumpCount || 0) + Number(count)
      }
    })

    return {
      success: true,
      recordId: res._id
    }
  } catch (err) {
    console.error('保存跳绳记录失败', err)
    return {
      success: false,
      message: '保存失败，请重试'
    }
  }
}