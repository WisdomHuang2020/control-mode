/**
 * 计算内核独立复核。
 *
 * 本站承诺「计算可复核」：tustin-core.mjs 不依赖 React / DOM / 浏览器，
 * 因此这里用 Node 直接 import 跑一遍，验证关键数值关系，而不是只看页面有没有渲染出来。
 * 任何一条断言失败都以退出码 1 结束，可直接挂 CI 门禁。
 */
import assert from 'node:assert/strict'
import {
  computeTustin, frequencyResponse, errorAt, differenceEquation,
  presetCoefficients, parseSeries, fmt,
} from '../src/lib/tustin-core.mjs'

const lead = presetCoefficients('lead')
const base = { num: lead.num, den: lead.den, T: 1e-6, fp: 200e3, delay: 0 }

// 1) 预置系数与解析式一致：1/ωz = 1/(2π·100 kHz)，1/ωp = 1/(2π·400 kHz)
assert.equal(lead.num[0], 1)
assert.ok(Math.abs(lead.num[1] - 1 / (2 * Math.PI * 100e3)) < 1e-18, 'lead 分子系数错')
assert.ok(Math.abs(lead.den[1] - 1 / (2 * Math.PI * 400e3)) < 1e-18, 'lead 分母系数错')
assert.equal(presetCoefficients('pi').den[1], 1)
assert.equal(presetCoefficients('pd').den.length, 1)
assert.equal(presetCoefficients('pid').den[0], 0)
assert.equal(presetCoefficients('custom'), null)

// 2) 基本量纲
const c = computeTustin(base)
assert.equal(c.fs, 1e6, 'fs 应为 1 MHz')
assert.equal(c.a_raw, 2e6, 'a_raw = 2/T')
assert.ok(c.k > 0 && c.k < 1, '预畸变系数应在 (0,1)')
assert.ok(Math.abs(c.a_eff - c.k * c.a_raw) < 1e-9, 'a_eff = k·2/T')
assert.ok(Math.abs(c.a_coef[0] - 1) < 1e-12, '分母须归一化到 a0 = 1')

// 3) 预畸变的定义性质：在 fw 处离散与连续的幅值、相位精确重合
//    s = k·(2/T)·(z-1)/(z+1)，当 ω=ωw 时 q=j·tan(ωT/2)，k 抵消正切 ⇒ s=jω。
const eFw = errorAt(base, c, base.fp)
assert.ok(Math.abs(eFw.dB) < 1e-6, `fw 处幅值偏差应为 0，实测 ${eFw.dB} dB`)
assert.ok(Math.abs(eFw.ph) < 1e-6, `fw 处相位偏差应为 0，实测 ${eFw.ph}°`)

// 4) 奈奎斯特附近必须真的有偏差（否则说明预畸变或频响算错了）
const eNy = errorAt(base, c, c.fs / 2 * 0.999)
assert.ok(Math.abs(eNy.dB) > 0.01 || Math.abs(eNy.ph) > 0.1, 'fs/2 附近不应与连续域重合')

// 5) 关闭预畸变 ⇒ k = 1，替换系数退化为 2/T
const cOff = computeTustin({ ...base, fp: 0 })
assert.equal(cOff.k, 1)
assert.equal(cOff.a_eff, 2e6)

// 6) 采样周期加倍 ⇒ fs 减半、a_raw 减半；fw 处仍精确重合
const slow = { ...base, T: 2e-6 }
const cSlow = computeTustin(slow)
assert.equal(cSlow.fs, 5e5)
assert.equal(cSlow.a_raw, 1e6)
const eSlow = errorAt(slow, cSlow, slow.fp)
assert.ok(Math.abs(eSlow.dB) < 1e-6 && Math.abs(eSlow.ph) < 1e-6, 'T 改变后 fw 处仍应重合')

// 7) 附加延时只压相位，不改幅值；在 fw 处也必然破坏重合
const d1 = { ...base, delay: 1 }
const cD1 = computeTustin(d1)
const eD1 = errorAt(d1, cD1, d1.fp)
assert.ok(Math.abs(eD1.ph - eFw.ph) > 1, '1 拍延时应显著改变相位偏差')
assert.ok(Math.abs(eD1.dB - eFw.dB) < 1e-6, '纯延时不改变幅值')
assert.ok(eD1.ph < eFw.ph, '延时使相位滞后')

// 8) 扫频曲线：长度、单调性、有限值
const fr = frequencyResponse(base, c)
assert.equal(fr.f.length, 460)
assert.ok(fr.f[0] < fr.f[1] && fr.f[459] > fr.f[458], '频率轴应单调递增')
assert.ok(Math.abs(fr.fmax - c.fs / 2) < 1e-9)
for (const arr of [fr.mag, fr.pha, fr.magD, fr.phaD]) {
  assert.equal(arr.length, 460)
  assert.ok(arr.every(Number.isFinite), '频响数据不得含 NaN/Inf')
}

// 9) 差分方程与格式化
const eq = differenceEquation(c.b, c.a_coef)
assert.ok(eq.startsWith('y[k] = '), eq)
assert.ok(eq.includes('e[k]') && eq.includes('y[k−1]'), eq)
assert.equal(fmt(0), '0')
assert.equal(fmt(1.23456, 4), '1.235')
assert.deepEqual(parseSeries('1, 2.5，-3'), [1, 2.5, -3])

console.log(`计算内核复核通过：${Object.keys({ lead: 1, pi: 1, pd: 1, pid: 1 }).length} 组预置、9 类断言`)
console.log(`  默认算例：fs=${c.fs / 1e6} MHz, k=${c.k.toFixed(6)}, fw 偏差=${eFw.dB.toExponential(2)} dB / ${eFw.ph.toExponential(2)}°`)
console.log(`  fs/2 偏差=${eNy.dB.toFixed(3)} dB / ${eNy.ph.toFixed(3)}°`)
