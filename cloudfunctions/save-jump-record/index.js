const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const COLLECTION = 'jump_records'

function isCollectionMissing(err) {
  const msg = (err && (err.errMsg || err.message)) || ''
  return (err && err.errCode === -502005) || /collection not exists|集合不存在/i.test(msg)
}

// 云开发不会自动创建集合，这里在集合不存在时自动建一次再写入
async function addJumpRecord(data) {
  try {
    return await db.collection(COLLECTION).add({ data })
  } catch (err) {
    if (isCollectionMissing(err)) {
      try {
        await db.createCollection(COLLECTION)
      } catch (e) {
        // 已存在 / 并发创建时忽略
        console.warn('createCollection 忽略:', e)
      }
      return await db.collection(COLLECTION).add({ data })
    }
    throw err
  }
}

function errorText(err) {
  if (!err) return '未知错误'
  const code = err.errCode ? `[${err.errCode}] ` : ''
  return code + (err.errMsg || err.message || String(err))
}

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
    const res = await addJumpRecord({
      openid,
      count: Number(count),
      duration: Number(duration) || 0,
      avgSpeed: Number(avgSpeed) || 0,
      maxContinuous: Number(maxContinuous) || 0,
      tripCount: Number(tripCount) || 0,
      calories: Math.round(Number(count) * 0.3),
      createTime: new Date()
    })

    // 累计次数更新失败不影响记录本身，避免“记录已写入却提示保存失败”
    try {
      await db
        .collection('users')
        .where({ openid })
        .update({ data: { totalJumpCount: _.inc(Number(count)) } })
    } catch (e) {
      console.warn('更新用户累计跳绳次数失败（不影响记录）:', e)
    }

    return {
      success: true,
      recordId: res._id
    }
  } catch (err) {
    console.error('保存跳绳记录失败', err)
    return {
      success: false,
      message: '保存失败：' + errorText(err)
    }
  }
}
