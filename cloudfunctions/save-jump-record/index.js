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
  let { count, duration, avgSpeed, maxContinuous, tripCount } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 统一转为数值，避免字符串 / NaN 绕过校验
  count = Number(count)
  duration = Number(duration)
  maxContinuous = Number(maxContinuous) || 0

  // ===== 业务校验规则（按顺序判断，任一不通过即返回，不执行写库） =====
  // 规则 1：基础数值防呆（防负数、防填0）
  if (!count || count <= 0 || !duration || duration <= 0) {
    return { success: false, message: '次数和时长必须大于0' }
  }
  // 规则 2：人体极限拦截（平均速度 > 240 次/分钟视为异常）
  const calcAvgSpeed = count / (duration / 60)
  if (calcAvgSpeed > 240) {
    return { success: false, message: '数据异常：平均速度过快，请如实填写' }
  }
  // 规则 3：时长下限拦截（时长不足 30 秒但次数超过 50 不符合常理）
  if (duration < 30 && count > 50) {
    return { success: false, message: '运动时长过短，请核对数据' }
  }
  // 规则 4：单次总量上限（单次跳绳不超过 5000 个）
  if (count > 5000) {
    return { success: false, message: '单次跳绳数量过高，若为多次累计请分开录入' }
  }
  // 规则 5：逻辑自洽校验（最高连跳不能大于总次数）
  if (maxContinuous > count) {
    return { success: false, message: '数据异常：最高连跳不能大于总次数' }
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