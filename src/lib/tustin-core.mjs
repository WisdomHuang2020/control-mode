/* =====================================================================
 * Tustin / 预畸变 计算内核 —— 纯函数、零 DOM 依赖、零第三方依赖。
 *
 * 这是本站「计算可复核」承诺的落点：整份模块可被 Node 直接 import，
 * 不依赖 React、浏览器或页面状态，scripts/test-tustin.mjs 会单独跑一遍核对。
 *
 * 数学关系：Gc(s) --( s = k·(2/T)·(z-1)/(z+1) )--> Gcd(z)
 *   k = (ωw·T/2) / tan(ωw·T/2)，fp = 0 时 k = 1（预畸变关闭）
 *
 * 数值逻辑与初版静态站 js/tustin.js 逐式一致，未做任何「优化改写」。
 * ===================================================================== */

/* ---------- 复数与多项式 ---------- */
export const C = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => {
    const d = b[0] * b[0] + b[1] * b[1]
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]
  },
  abs: (a) => Math.hypot(a[0], a[1]),
  arg: (a) => Math.atan2(a[1], a[0]),
}

export function polyEval(c, s) {
  let r = [0, 0]
  for (let i = c.length - 1; i >= 0; i--) r = C.add(C.mul(r, s), [c[i], 0])
  return r
}
export function polyAdd(a, b) {
  const n = Math.max(a.length, b.length), o = new Array(n).fill(0)
  for (let i = 0; i < n; i++) o[i] = (a[i] || 0) + (b[i] || 0)
  return o
}
export function polyMul(a, b) {
  const o = new Array(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) o[i + j] += a[i] * b[j]
  return o
}
export function polyPow(p, e) {
  let r = [1]
  for (let i = 0; i < e; i++) r = polyMul(r, p)
  return r
}
export function polyDeg(c) {
  for (let i = c.length - 1; i >= 0; i--) if (Math.abs(c[i]) > 1e-15) return i
  return 0
}

/** s = a·(z-1)/(z+1) 代入：分子分母同乘 (z+1)^M */
export function substitute(num, den, a) {
  const M = Math.max(polyDeg(num), polyDeg(den))
  const Zm1 = [-1, 1], Zp1 = [1, 1]
  const nz = new Array(M + 1).fill(0), dz = new Array(M + 1).fill(0)
  for (let i = 0; i <= M; i++) {
    const c = i < num.length ? num[i] : 0
    if (c !== 0) {
      const t = polyMul(polyMul([c * Math.pow(a, i)], polyPow(Zm1, i)), polyPow(Zp1, M - i))
      for (let j = 0; j < t.length; j++) nz[j] += t[j]
    }
    const d = i < den.length ? den[i] : 0
    if (d !== 0) {
      const u = polyMul(polyMul([d * Math.pow(a, i)], polyPow(Zm1, i)), polyPow(Zp1, M - i))
      for (let j = 0; j < u.length; j++) dz[j] += u[j]
    }
  }
  return { n: nz, d: dz, M }
}

/** 转成 z^-1 形式：G = (b0 + b1 z^-1 + ...)/(1 + a1 z^-1 + ...) */
export function toNegPowers(nz, dz, M) {
  const top = dz[M]
  const b = [], a = []
  for (let j = 0; j <= M; j++) {
    b.push(nz[M - j] / top)
    a.push(dz[M - j] / top)
  }
  while (b.length > 1 && Math.abs(b[b.length - 1]) < 1e-12) b.pop()
  while (a.length > 1 && Math.abs(a[a.length - 1]) < 1e-12) a.pop()
  return { b, a }
}

/* ---------- 格式化 ---------- */
export function fmt(x, sig) {
  if (!isFinite(x)) return '—'
  if (x === 0) return '0'
  const ax = Math.abs(x)
  if (ax >= 1e5 || ax < 1e-3) return x.toExponential(sig ? sig - 1 : 2)
  return parseFloat(x.toPrecision(sig || 4)).toString()
}

export function polyText(c, varname) {
  const parts = []
  for (let i = c.length - 1; i >= 0; i--) {
    const v = c[i]
    if (Math.abs(v) < 1e-12) continue
    const s = v >= 0 && parts.length ? ' + ' : v < 0 ? ' − ' : ''
    const av = Math.abs(v)
    const coefTxt = Math.abs(av - 1) < 1e-12 ? '' : fmt(av, 5)
    const pw = i === 0 ? '' : i === 1 ? varname : `${varname}^${i}`
    parts.push(s + (coefTxt && pw ? coefTxt + '·' : coefTxt) + pw)
  }
  return parts.length ? parts.join('') : '0'
}

export function texPoly(c, v) {
  let out = ''
  for (let i = c.length - 1; i >= 0; i--) {
    const x = c[i]
    if (Math.abs(x) < 1e-12) continue
    const sign = x < 0 ? '-' : out ? '+' : ''
    const av = Math.abs(x)
    const coef = Math.abs(av - 1) < 1e-12 ? '' : fmt(av, 4)
    const pow = i === 0 ? '' : i === 1 ? v : `${v}^{${i}}`
    if (!coef && !pow) out += sign + '1'
    else out += sign + (coef && pow ? coef + '\\,' : coef) + pow
  }
  return out || '0'
}

export function texNeg(c) {
  let out = ''
  for (let i = 0; i < c.length; i++) {
    const v = c[i]
    if (Math.abs(v) < 1e-12) continue
    const sign = v < 0 ? '-' : out ? '+' : ''
    const av = Math.abs(v)
    const pow = i === 0 ? '' : i === 1 ? 'z^{-1}' : `z^{-${i}}`
    out += sign + fmt(av, 4) + (pow ? '\\,' + pow : '')
  }
  return out || '0'
}

/* ---------- 预置 ---------- */
export const PRESETS = {
  lead: { label: '超前补偿', fz: 100e3, fp: 400e3, build: (fz, fp) => ({ num: [1, 1 / (2 * Math.PI * fz)], den: [1, 1 / (2 * Math.PI * fp)] }) },
  pi: { label: 'PI', fL: 20e3, build: (fL) => ({ num: [2 * Math.PI * fL, 1], den: [0, 1] }) },
  pd: { label: 'PD', fz: 100e3, build: (fz) => ({ num: [1, 1 / (2 * Math.PI * fz)], den: [1] }) },
  pid: {
    label: 'PID', fL: 8e3, fz: 33e3,
    build: (fL, fz) => ({ num: polyMul([1, 1 / (2 * Math.PI * fz)], [2 * Math.PI * fL, 1]), den: [0, 1] }),
  },
}

export function presetCoefficients(key) {
  const p = PRESETS[key]
  if (!p) return null
  if (key === 'lead') return p.build(p.fz, p.fp)
  if (key === 'pi') return p.build(p.fL)
  if (key === 'pd') return p.build(p.fz)
  return p.build(p.fL, p.fz)
}

export function parseSeries(txt) {
  return txt.split(/[,，\s]+/).map((x) => parseFloat(x)).filter((x) => isFinite(x))
}

/* ---------- 核心：离散化 ----------
 * params = { num, den, T, fp, delay }
 *   num/den 按 s 升幂；T 单位秒；fp 单位 Hz（0 = 关闭预畸变）；delay 单位采样周期
 */
export function computeTustin(params) {
  const { num, den, T, fp } = params
  const fs = 1 / T
  const a_raw = 2 / T
  let k = 1
  const wp = 2 * Math.PI * fp
  const x = wp * T / 2
  if (fp > 0 && Math.abs(x) > 1e-9 && Math.abs(Math.tan(x)) > 1e-9) k = x / Math.tan(x)
  const a = k * a_raw
  const sub = substitute(num, den, a)
  const nz = toNegPowers(sub.n, sub.d, sub.M)
  return { fs, a_raw, k, a_eff: a, a, b: nz.b, a_coef: nz.a, M: sub.M }
}

/* ---------- 频响 ---------- */
export function Gc(params, w) {
  const s = [0, w]
  return C.div(polyEval(params.num, s), polyEval(params.den, s))
}

export function Gcd(params, w, a, delay) {
  const z = [Math.cos(w * params.T), Math.sin(w * params.T)]
  const q = C.div(C.sub(z, [1, 0]), C.add(z, [1, 0]))
  const s = [a * q[0], a * q[1]]
  let g = C.div(polyEval(params.num, s), polyEval(params.den, s))
  if (delay) {
    const ph = -w * params.T * delay
    g = C.mul(g, [Math.cos(ph), Math.sin(ph)])
  }
  return g
}

/** 生成整条对数扫频曲线，供绘图组件消费。 */
export function frequencyResponse(params, computed, N = 460) {
  const fmin = Math.max(10, computed.fs / 2000)
  const fmax = computed.fs / 2
  const mag = [], pha = [], magD = [], phaD = [], f = []
  for (let i = 0; i < N; i++) {
    const fi = fmin * Math.pow(fmax / fmin, i / (N - 1))
    const w = 2 * Math.PI * fi
    const g1 = Gc(params, w), g2 = Gcd(params, w, computed.a_eff, params.delay)
    f.push(fi)
    mag.push(20 * Math.log10(Math.max(C.abs(g1), 1e-12)))
    pha.push(C.arg(g1) * 180 / Math.PI)
    magD.push(20 * Math.log10(Math.max(C.abs(g2), 1e-12)))
    phaD.push(C.arg(g2) * 180 / Math.PI)
  }
  return { f, fmin, fmax, mag, pha, magD, phaD }
}

/** 指定频率处「离散 − 连续」的幅值（dB）与相位（°）偏差。 */
export function errorAt(params, computed, freq) {
  if (freq <= 0) return null
  const w = 2 * Math.PI * freq
  const g1 = Gc(params, w), g2 = Gcd(params, w, computed.a_eff, params.delay)
  const dB = 20 * Math.log10(C.abs(g2) / C.abs(g1))
  let dph = (C.arg(g2) - C.arg(g1)) * 180 / Math.PI
  while (dph > 180) dph -= 360
  while (dph < -180) dph += 360
  return { dB, ph: dph }
}

/** 差分方程文本：y[k] = b0·e[k] + ... − a1·y[k−1] ... */
export function differenceEquation(b, aCoef) {
  const terms = []
  for (let j = 0; j < b.length; j++) {
    if (Math.abs(b[j]) < 1e-12) continue
    terms.push(fmt(b[j], 4) + (j === 0 ? '·e[k]' : `·e[k−${j}]`))
  }
  for (let j = 1; j < aCoef.length; j++) {
    if (Math.abs(aCoef[j]) < 1e-12) continue
    const v = -aCoef[j]
    terms.push((v >= 0 ? '+ ' : '− ') + fmt(Math.abs(v), 4) + `·y[k−${j}]`)
  }
  return 'y[k] = ' + terms.join(' ')
}
