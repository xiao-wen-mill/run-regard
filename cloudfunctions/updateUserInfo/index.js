const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { nickName, gender, age, height, weight } = event

  if (!nickName) {
    return { success: false, message: '昵称不能为空' }
  }

  try {
    const userRes = await db.collection('users').where({ openid }).get()

    if (userRes.data.length === 0) {
      return { success: false, message: '用户不存在' }
    }

    const userId = userRes.data[0]._id

    await db.collection('users').doc(userId).update({
      data: {
        nickName: nickName,
        gender: gender || '',
        age: Number(age) || 0,
        height: Number(height) || 0,
        weight: Number(weight) || 0,
      },
    })

    const updatedUser = {
      nickName: nickName,
      avatarUrl: userRes.data[0].avatarUrl || '',
      gender: gender || '',
      age: Number(age) || 0,
      height: Number(height) || 0,
      weight: Number(weight) || 0,
      totalRunCount: userRes.data[0].totalRunCount || 0,
      totalDistance: userRes.data[0].totalDistance || 0,
    }

    return {
      success: true,
      message: '更新成功',
      userInfo: updatedUser,
    }
  } catch (err) {
    console.error('更新用户信息失败:', err)
    return { success: false, message: '更新失败，请重试' }
  }
}