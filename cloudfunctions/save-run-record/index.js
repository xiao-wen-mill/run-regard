const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * Haversine 公式计算两点之间的距离（米）
 * @param {number} lat1 起点纬度
 * @param {number} lon1 起点经度
 * @param {number} lat2 终点纬度
 * @param {number} lon2 终点经度
 * @returns {number} 距离（米）
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // 地球平均半径（米）
  const phi1 = lat1 * Math.PI / 180
  const phi2 = lat2 * Math.PI / 180
  const deltaPhi = (lat2 - lat1) * Math.PI / 180
  const deltaLambda = (lon2 - lon1) * Math.PI / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 根据GPS点列表计算总距离（米）
 * @param {Array} gpsPoints GPS轨迹点数组
 * @returns {number} 总距离（米）
 */
function calculateDistance(gpsPoints) {
  if (!gpsPoints || gpsPoints.length < 2) {
    return 0
  }

  let totalDistance = 0
  for (let i = 1; i < gpsPoints.length; i++) {
    const prev = gpsPoints[i - 1]
    const curr = gpsPoints[i]

    // GPS点过滤：速度超过 10 m/s（36 km/h）视为异常点
    const timeDiff = curr.timestamp - prev.timestamp
    if (timeDiff > 0) {
      const distance = haversineDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      )
      const speed = distance / (timeDiff / 1000)

      // 速度不超过 10 m/s 才计入
      if (speed <= 10) {
        totalDistance += distance
      }
    }
  }
  return totalDistance
}

/**
 * 根据体重和距离计算卡路里消耗
 * 公式：卡路里（千卡）= 体重（kg）× 距离（km）× 1.036
 * @param {number} weight 体重（kg）
 * @param {number} distance 距离（米）
 * @returns {number} 卡路里（千卡）
 */
function calculateCalories(weight, distance) {
  const distanceKm = distance / 1000
  return Math.round(weight * distanceKm * 1.036)
}

/**
 * 根据时长和距离计算配速（分钟/公里）
 * @param {number} duration 时长（秒）
 * @param {number} distance 距离（米）
 * @returns {number} 配速（秒/公里）
 */
function calculatePace(duration, distance) {
  const distanceKm = distance / 1000
  if (distanceKm <= 0) return 0
  return Math.round(duration / distanceKm)
}

exports.main = async (event, context) => {
  // 接收前端传来的数据
  const {
    duration,    // 总时长（秒）
    distance,    // 总距离（米）
    calories,    // 卡路里（千卡）
    avgPace,     // 配速（秒/公里 或 字符串）
    startTime,   // 开始时间（ISO字符串）
    endTime,     // 结束时间（ISO字符串）
    gpsPoints    // GPS轨迹点列表（可选）
  } = event

  // 获取用户 openid
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 参数校验
  if (!duration || duration <= 0) {
    return {
      success: false,
      message: '跑步时长必须大于0'
    }
  }

  try {
    // 获取用户信息（用于计算默认卡路里）
    let userWeight = 60
    let userId = null

    const usersCollection = db.collection('users')
    const userResult = await usersCollection.where({ openid: openid }).get()

    if (userResult.data.length > 0) {
      const user = userResult.data[0]
      userId = user._id
      userWeight = user.weight || 60
    }

    // 计算距离（优先使用前端传入的值，若无则用GPS点计算）
    let finalDistance = Number(distance) || 0
    if (!finalDistance && gpsPoints && gpsPoints.length >= 2) {
      finalDistance = Math.round(calculateDistance(gpsPoints))
    }

    // 计算配速（优先使用前端传入的值，若无则计算）
    let finalPace = typeof avgPace === 'number' ? avgPace :
      (typeof avgPace === 'string' ? parseFloat(avgPace) : 0)
    if (!finalPace && finalDistance > 0) {
      finalPace = calculatePace(duration, finalDistance)
    }

    // 计算卡路里（优先使用前端传入的值，若无则计算）
    let finalCalories = Number(calories) || 0
    if (!finalCalories && finalDistance > 0) {
      finalCalories = calculateCalories(userWeight, finalDistance)
    }

    // 转换开始时间和结束时间
    const startTimeDate = startTime ? new Date(startTime) : new Date()
    const endTimeDate = endTime ? new Date(endTime) : new Date()

    // 存入跑步记录
    const res = await db.collection('run_records').add({
      data: {
        openid: openid,
        duration: Number(duration),       // 总时长（秒）
        distance: finalDistance,          // 总距离（米）
        calories: finalCalories,          // 卡路里（千卡）
        avgPace: finalPace,               // 配速（秒/公里）
        startTime: startTimeDate,         // 开始时间
        endTime: endTimeDate,             // 结束时间
        gpsPoints: gpsPoints || [],       // GPS轨迹点列表
        createTime: new Date()            // 记录创建时间
      }
    })

    // 更新用户的统计数据（总次数、总距离）
    // 注意：totalDistance 单位为公里，需将米转换为公里
    if (userId) {
      const distanceKm = finalDistance / 1000
      await usersCollection.doc(userId).update({
        data: {
          totalRunCount: (userResult.data[0].totalRunCount || 0) + 1,
          totalDistance: Math.round(((userResult.data[0].totalDistance || 0) + distanceKm) * 100) / 100
        }
      })
    }

    return {
      success: true,
      message: '记录保存成功',
      recordId: res._id,
      data: {
        duration: Number(duration),
        distance: finalDistance,
        calories: finalCalories,
        avgPace: finalPace
      }
    }
  } catch (err) {
    console.error('保存失败', err)
    return {
      success: false,
      message: '保存失败，请重试'
    }
  }
}