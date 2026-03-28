// cloudfunctions/saveRunRecord/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

exports.main = async (event, context) => {
  const { duration, distance, components } = event
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
    // 将数据存入集合（假设集合名为 run_records）
    const res = await db.collection('run_records').add({
      data: {
        openid,
        duration: Number(duration),
        distance: Number(distance),
        createTime: db.serverDate(),
        components: components || {}
      }
    })
    return {
      success: true,
      message: '记录保存成功',
      id: res._id
    }
  } catch (err) {
    console.error('保存失败', err)
    return {
      success: false,
      message: '保存失败，请重试'
    }
  }
}