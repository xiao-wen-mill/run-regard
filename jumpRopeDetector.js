/**
 * jumpRopeDetector.js
 * 
 * 基于加速度数据的跳绳检测器
 * 
 * 输入：加速度数据数组 [{x, y, z, timestamp}, ...]
 * 输出：{ count, avgSpeed, maxContinuous, tripCount, confidence }
 * 
 * 算法：
 * 1. ENMO = sqrt(x²+y²+z²) - 9.8，负值归零
 * 2. 波峰检测：局部最大值 + 阈值过滤
 * 3. 时间窗口过滤：相邻波峰间隔 0.2-0.8 秒为有效跳绳
 * 4. 绊绳检测：间隔 > 0.8 秒视为绊绳
 * 5. 最大连续次数：连续无绊绳的最大计数
 * 6. 置信度：基于波峰形态与理想跳绳波形的匹配程度
 */

/**
 * 跳绳检测主函数
 * @param {Array<{x: number, y: number, z: number, timestamp: number}>} accData - 加速度数据数组
 * @param {number} threshold - ENMO 阈值，默认 2.0 m/s²
 * @returns {{ count: number, avgSpeed: number, maxContinuous: number, tripCount: number, confidence: number }}
 */
function jumpRopeDetector(accData, threshold = 2.0) {
    // ========== 1. 输入验证 ==========
    if (!accData || !Array.isArray(accData) || accData.length < 3) {
        return { count: 0, avgSpeed: 0, maxContinuous: 0, tripCount: 0, confidence: 0 };
    }

    // ========== 2. 计算 ENMO ==========
    // ENMO = sqrt(x²+y²+z²) - 9.8，负值归零
    const enmo = accData.map(d => {
        const magnitude = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
        const value = magnitude - 9.8;
        return value > 0 ? value : 0;
    });

    // ========== 3. 估计采样率 ==========
    const timestamps = accData.map(d => d.timestamp);
    let intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    // 去除异常间隔（使用中位数更稳健）
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    const sampleRate = 1 / medianInterval; // Hz

    // 如果采样率过低（< 15Hz），无法准确检测
    if (sampleRate < 15) {
        return { count: 0, avgSpeed: 0, maxContinuous: 0, tripCount: 0, confidence: 0 };
    }

    // ========== 4. 波峰检测 ==========
    // 窗口半径：对应 0.08 秒（80ms），用于检测局部最大值
    const windowRadius = Math.max(1, Math.floor(0.08 * sampleRate));
    const peaks = [];

    for (let i = windowRadius; i < enmo.length - windowRadius; i++) {
        // 阈值过滤
        if (enmo[i] <= threshold) continue;

        // 检查是否为局部最大值
        let isPeak = true;
        for (let j = i - windowRadius; j <= i + windowRadius; j++) {
            if (j === i) continue;
            if (enmo[j] >= enmo[i]) {
                isPeak = false;
                break;
            }
        }

        if (isPeak) {
            peaks.push({
                index: i,
                value: enmo[i],
                timestamp: accData[i].timestamp,
                // 计算邻域平均值（用于尖锐度计算）
                neighborMean: calculateNeighborMean(enmo, i, windowRadius)
            });
        }
    }

    // 如果波峰太少，无法进行有效统计
    if (peaks.length < 2) {
        return { count: 0, avgSpeed: 0, maxContinuous: 0, tripCount: 0, confidence: 0 };
    }

    // ========== 5. 波峰过滤（确保相邻波峰间隔 >= 0.2秒） ==========
    const filteredPeaks = [];
    for (let i = 0; i < peaks.length; i++) {
        if (filteredPeaks.length === 0) {
            filteredPeaks.push(peaks[i]);
            continue;
        }
        const last = filteredPeaks[filteredPeaks.length - 1];
        const interval = peaks[i].timestamp - last.timestamp;
        if (interval >= 0.2) {
            filteredPeaks.push(peaks[i]);
        } else {
            // 如果间隔 < 0.2秒，保留波峰更高的那个
            if (peaks[i].value > last.value) {
                filteredPeaks[filteredPeaks.length - 1] = peaks[i];
            }
        }
    }

    if (filteredPeaks.length < 2) {
        return { count: 0, avgSpeed: 0, maxContinuous: 0, tripCount: 0, confidence: 0 };
    }

    // ========== 6. 分析波峰间隔 ==========
    let validCount = 0; // 有效跳绳次数
    let tripCount = 0; // 绊绳次数
    let continuousCount = 0; // 当前连续计数
    let maxContinuous = 0; // 最大连续次数
    let totalValidInterval = 0; // 所有有效间隔的总和（秒）
    let validIntervals = []; // 所有有效间隔列表（用于计算变异系数）
    let peakValues = []; // 所有波峰值列表（用于计算变异系数）
    let sharpnessValues = []; // 所有波峰的尖锐度

    // 收集波峰值和尖锐度
    for (const p of filteredPeaks) {
        peakValues.push(p.value);
        const sharpness = p.value / (p.neighborMean + 0.1);
        sharpnessValues.push(sharpness);
    }

    for (let i = 1; i < filteredPeaks.length; i++) {
        const interval = filteredPeaks[i].timestamp - filteredPeaks[i - 1].timestamp;

        if (interval >= 0.2 && interval <= 0.8) {
            // 有效跳绳
            validCount++;
            totalValidInterval += interval;
            validIntervals.push(interval);
            continuousCount++;
            if (continuousCount > maxContinuous) {
                maxContinuous = continuousCount;
            }
        } else if (interval > 0.8) {
            // 绊绳
            tripCount++;
            continuousCount = 0;
        } else {
            // interval < 0.2，已被过滤，理论上不会发生
            continuousCount = 0;
        }
    }

    // ========== 7. 计算平均速度 ==========
    // 使用有效跳绳的总时间计算平均速度（次/分钟）
    let avgSpeed = 0;
    if (validCount > 0 && totalValidInterval > 0) {
        avgSpeed = validCount / (totalValidInterval / 60);
    }

    // ========== 8. 计算置信度 ==========
    const confidence = calculateConfidence(
        peakValues,
        validIntervals,
        sharpnessValues,
        validCount,
        filteredPeaks.length
    );

    // ========== 9. 返回结果 ==========
    return {
        count: validCount,
        avgSpeed: Math.round(avgSpeed * 10) / 10, // 保留一位小数
        maxContinuous: maxContinuous,
        tripCount: tripCount,
        confidence: Math.round(confidence * 100) / 100 // 保留两位小数
    };
}

/**
 * 计算邻域平均值（不包括中心点）
 */
function calculateNeighborMean(enmo, centerIndex, radius) {
    let sum = 0;
    let count = 0;
    for (let i = centerIndex - radius; i <= centerIndex + radius; i++) {
        if (i === centerIndex) continue;
        if (i >= 0 && i < enmo.length) {
            sum += enmo[i];
            count++;
        }
    }
    return count > 0 ? sum / count : 0;
}

/**
 * 计算置信度
 * 综合考虑：波峰高度一致性、间隔均匀性、有效比例、波峰尖锐度
 */
function calculateConfidence(peakValues, validIntervals, sharpnessValues, validCount, totalPeaks) {
    if (peakValues.length < 2 || validCount === 0) {
        return 0;
    }

    // ---- 8.1 波峰高度变异系数 ----
    const meanPeak = peakValues.reduce((a, b) => a + b, 0) / peakValues.length;
    let stdPeak = 0;
    for (const v of peakValues) {
        stdPeak += (v - meanPeak) * (v - meanPeak);
    }
    stdPeak = Math.sqrt(stdPeak / peakValues.length);
    const cvPeak = meanPeak > 0 ? stdPeak / meanPeak : 1;
    const heightScore = 1 / (1 + cvPeak * 1.5);

    // ---- 8.2 有效间隔变异系数 ----
    let intervalScore = 1;
    if (validIntervals.length >= 2) {
        const meanInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        let stdInterval = 0;
        for (const v of validIntervals) {
            stdInterval += (v - meanInterval) * (v - meanInterval);
        }
        stdInterval = Math.sqrt(stdInterval / validIntervals.length);
        const cvInterval = meanInterval > 0 ? stdInterval / meanInterval : 1;
        intervalScore = 1 / (1 + cvInterval * 1.5);
    } else if (validIntervals.length === 1) {
        // 只有一个有效间隔，无法计算变异系数，给予中等分数
        intervalScore = 0.7;
    }

    // ---- 8.3 有效跳绳比例 ----
    const validRatio = totalPeaks > 0 ? validCount / (totalPeaks - 1) : 0;

    // ---- 8.4 波峰尖锐度 ----
    const avgSharpness = sharpnessValues.reduce((a, b) => a + b, 0) / sharpnessValues.length;
    // 理想跳绳波形的尖锐度通常在 1.5-4 之间
    const sharpnessScore = Math.min(avgSharpness / 2.0, 1);

    // ---- 8.5 综合置信度 ----
    // 使用加权乘积，每个因子都对置信度有贡献
    let confidence = heightScore * intervalScore * validRatio * sharpnessScore;

    // 如果有效跳绳次数较少，降低置信度
    if (validCount < 3) {
        confidence *= (validCount / 3);
    }

    // 限制在 0-1 之间
    confidence = Math.max(0, Math.min(1, confidence));

    return confidence;
}

// ========== 导出模块 ==========
// 支持 CommonJS 和 ES6 模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = jumpRopeDetector;
} else if (typeof define === 'function' && define.amd) {
    define(function () {
        return jumpRopeDetector;
    });
} else {
    window.jumpRopeDetector = jumpRopeDetector;
}