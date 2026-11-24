import { useCallback, useEffect, useRef, useState } from 'react'
import type { DemoKind } from '../data/prereq/types'

/**
 * 前置知识模块的交互式动态组件。
 *
 * 与视频的分工：
 *   视频 = 把一段变化讲完一遍（用户看，不动手）；
 *   交互 = 把参数交给用户，让他自己把结论「摸」出来。
 * 两者用的是同一套数学公式，所以不会出现「视频里说 A、交互里画成 B」。
 *
 * 实现约束：
 *   ① 颜色全部从 CSS 变量读（getComputedStyle），这样 8 套主题都自动适配；
 *   ② 画布用逻辑坐标 860×400 绘制，再按 devicePixelRatio 放大，避免高分屏发虚；
 *   ③ 坐标轴一律等比例（equal aspect），s 平面 / z 平面这类图不能拉伸。
 */

const W = 860
const H = 400

// ── 主题色：从 CSS 变量取，随 8 套主题自动切换 ──────────────────────────
interface Palette {
  bg: string
  panel: string
  border: string
  grid: string
  axis: string
  text: string
  muted: string
  blue: string
  green: string
  amber: string
  slate: string
}

function palette(): Palette {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string, fallback: string) => cs.getPropertyValue(n).trim() || fallback
  return {
    bg: v('--color-surface', '#171717'),
    panel: v('--color-surface-elevated', '#262626'),
    border: v('--color-border', '#404040'),
    grid: v('--color-border', '#404040'),
    axis: v('--color-text-muted', '#737373'),
    text: v('--color-text-primary', '#f5f5f5'),
    muted: v('--color-text-secondary', '#a3a3a3'),
    blue: v('--color-primary-light', '#14b8a6'),
    green: '#48d597',
    amber: '#f0a24f',
    slate: '#6b7ea3',
  }
}

// ── 绘图基元 ──────────────────────────────────────────────────────────
type Panel = { x: number; y: number; w: number; h: number }

function panelRect(ctx: CanvasRenderingContext2D, p: Panel, c: Palette, label: string) {
  ctx.fillStyle = c.panel
  ctx.fillRect(p.x, p.y, p.w, p.h)
  ctx.strokeStyle = c.border
  ctx.lineWidth = 1
  ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1)
  ctx.fillStyle = c.text
  ctx.font = '600 13px "Microsoft YaHei", system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(label, p.x + 10, p.y + 18)
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, size = 11) {
  ctx.fillStyle = color
  ctx.font = `${size}px "Microsoft YaHei", system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(text, x, y)
}

/** 等比例坐标映射：s 平面、z 平面这类图绝不能被拉伸成椭圆。 */
function mapEq(p: Panel, xlim: [number, number], ylim: [number, number]) {
  const s = Math.min(p.w / (xlim[1] - xlim[0]), p.h / (ylim[1] - ylim[0]))
  const cx = (xlim[0] + xlim[1]) / 2
  const cy = (ylim[0] + ylim[1]) / 2
  return {
    X: (x: number) => p.x + p.w / 2 + (x - cx) * s,
    Y: (y: number) => p.y + p.h / 2 - (y - cy) * s,
    s,
  }
}

/** 不等比例映射：时域曲线用这个，否则波形会被压扁。 */
function mapLin(p: Panel, xlim: [number, number], ylim: [number, number]) {
  return {
    X: (x: number) => p.x + ((x - xlim[0]) / (xlim[1] - xlim[0])) * p.w,
    Y: (y: number) => p.y + p.h - ((y - ylim[0]) / (ylim[1] - ylim[0])) * p.h,
  }
}

function cross(ctx: CanvasRenderingContext2D, m: { X: (x: number) => number; Y: (y: number) => number }, c: Palette) {
  ctx.strokeStyle = c.axis
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(m.X(-1e6), m.Y(0))
  ctx.lineTo(m.X(1e6), m.Y(0))
  ctx.moveTo(m.X(0), m.Y(-1e6))
  ctx.lineTo(m.X(0), m.Y(1e6))
  ctx.stroke()
}

function grid(ctx: CanvasRenderingContext2D, p: Panel, c: Palette, nx = 6, ny = 4) {
  ctx.strokeStyle = c.grid
  ctx.globalAlpha = 0.25
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 1; i < nx; i++) {
    const x = p.x + (p.w * i) / nx
    ctx.moveTo(x, p.y)
    ctx.lineTo(x, p.y + p.h)
  }
  for (let i = 1; i < ny; i++) {
    const y = p.y + (p.h * i) / ny
    ctx.moveTo(p.x, y)
    ctx.lineTo(p.x + p.w, y)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], color: string, width = 2) {
  if (pts.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, r = 5) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

// ── 参数定义 ──────────────────────────────────────────────────────────
type Param = {
  key: 'a' | 'b'
  label: string
  min: number
  max: number
  step: number
  /** 初始值，缺省取 min */
  def?: number
  fmt: (v: number) => string
  hint?: string
}

const PARAMS: Record<DemoKind, Param[]> = {
  'complex-mapping': [
    { key: 'a', label: '辐角 θ', min: 0, max: 360, step: 1, fmt: (v) => `${v.toFixed(0)}°` },
    { key: 'b', label: '半径 r', min: 0.3, max: 1.4, step: 0.01, def: 1, fmt: (v) => v.toFixed(2) },
  ],
  'fourier-series': [
    { key: 'a', label: '谐波次数 N', min: 1, max: 21, step: 2, fmt: (v) => v.toFixed(0) },
  ],
  'laplace-poles': [
    { key: 'a', label: '阻尼比 ζ', min: 0.03, max: 1, step: 0.01, def: 0.25, fmt: (v) => v.toFixed(2) },
    { key: 'b', label: '自然频率 ωn', min: 0.5, max: 4, step: 0.1, def: 3, fmt: (v) => v.toFixed(1) },
  ],
  'z-mapping': [
    { key: 'a', label: '极点实部 −σ', min: 0, max: 4, step: 0.02, def: 1, fmt: (v) => v.toFixed(2) },
  ],
  'state-space': [
    { key: 'a', label: '反馈增益 g', min: 0, max: 3, step: 0.05, def: 1, fmt: (v) => v.toFixed(2) },
    { key: 'b', label: '步数 k', min: 6, max: 120, step: 1, def: 40, fmt: (v) => v.toFixed(0) },
  ],
  'law-of-large-numbers': [
    { key: 'a', label: '路径条数', min: 5, max: 40, step: 1, def: 20, fmt: (v) => v.toFixed(0) },
  ],
}

// ── 各演示的绘制逻辑 ──────────────────────────────────────────────────

function drawComplex(ctx: CanvasRenderingContext2D, c: Palette, thetaDeg: number, r: number) {
  const th = (thetaDeg * Math.PI) / 180
  const pL: Panel = { x: 24, y: 26, w: 388, h: 348 }
  const pR: Panel = { x: 448, y: 26, w: 388, h: 348 }
  panelRect(ctx, pL, c, 'z 平面')
  panelRect(ctx, pR, c, 'w 平面')
  const mL = mapEq(pL, [-1.8, 1.8], [-1.8, 1.8])
  const mR = mapEq(pR, [-2.6, 2.6], [-2.6, 2.6])
  cross(ctx, mL, c)
  cross(ctx, mR, c)

  // 单位圆（淡）
  ctx.strokeStyle = c.border
  ctx.globalAlpha = 0.7
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.arc(mL.X(0), mL.Y(0), r * mL.s, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  // 已走过的弧
  const n = 120
  const arc: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = (th * i) / n
    arc.push([mL.X(r * Math.cos(a)), mL.Y(r * Math.sin(a))])
  }
  poly(ctx, arc, c.blue, 2.2)
  poly(ctx, [[mL.X(0), mL.Y(0)], arc[arc.length - 1]], c.amber, 2.4)
  dot(ctx, arc[arc.length - 1][0], arc[arc.length - 1][1], '#ffd08a')

  // 映射后：辐角翻倍、半径平方
  const arcW: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = (2 * th * i) / n
    arcW.push([mR.X(r * r * Math.cos(a)), mR.Y(r * r * Math.sin(a))])
  }
  poly(ctx, arcW, c.green, 2.2)
  poly(ctx, [[mR.X(0), mR.Y(0)], arcW[arcW.length - 1]], c.amber, 2.4)
  dot(ctx, arcW[arcW.length - 1][0], arcW[arcW.length - 1][1], '#7ef0bb')

  label(ctx, pL.x + 12, pL.y + 28, `θ = ${thetaDeg.toFixed(1)}°`, '#ffd08a')
  label(ctx, pR.x + 12, pR.y + 28, `2θ = ${(2 * thetaDeg).toFixed(1)}°`, '#7ef0bb')
  label(ctx, pL.x + 12, pL.y + pL.h - 26, `w = z²：半径平方、辐角翻倍`, c.muted, 11)
}

function drawFourier(ctx: CanvasRenderingContext2D, c: Palette, N: number) {
  const p: Panel = { x: 24, y: 26, w: 812, h: 348 }
  panelRect(ctx, p, c, `方波的傅里叶级数（取到第 ${N} 次谐波）`)
  grid(ctx, p, c, 8, 4)
  const m = mapLin(p, [0, 4 * Math.PI], [-1.45, 1.45])
  cross(ctx, m, c)
  const t: number[] = []
  const f: number[] = []
  const s: number[] = []
  const Nn = 800
  for (let i = 0; i <= Nn; i++) {
    const x = (4 * Math.PI * i) / Nn
    t.push(x)
    f.push(Math.sign(Math.sin(x)))
    let acc = 0
    for (let k = 1; k <= N; k += 2) acc += Math.sin(k * x) / k
    s.push((4 / Math.PI) * acc)
  }
  poly(ctx, t.map((x, i) => [m.X(x), m.Y(f[i])] as [number, number]), c.slate, 1.4)
  poly(ctx, t.map((x, i) => [m.X(x), m.Y(s[i])] as [number, number]), c.blue, 2)
  label(ctx, p.x + 12, p.y + 28, '灰＝原方波　蓝＝部分和', c.muted, 11)
  label(ctx, p.x + 12, p.y + p.h - 28, '不连续点附近 9% 的 Gibbs 超量不随 N 消失', c.muted, 11)
}

function drawLaplace(ctx: CanvasRenderingContext2D, c: Palette, zeta: number, wn: number) {
  const pL: Panel = { x: 24, y: 26, w: 388, h: 348 }
  const pR: Panel = { x: 448, y: 26, w: 388, h: 348 }
  panelRect(ctx, pL, c, 's 平面')
  panelRect(ctx, pR, c, '单位阶跃响应')
  const mL = mapEq(pL, [-5, 1.2], [-4.6, 4.6])
  const mR = mapLin(pR, [0, 8], [-0.45, 1.6])
  grid(ctx, pL, c)
  grid(ctx, pR, c)
  cross(ctx, mL, c)
  cross(ctx, mR, c)

  const pr = -zeta * wn
  const pi = wn * Math.sqrt(Math.max(1e-9, 1 - zeta * zeta))
  // 虚线轴标注
  ctx.strokeStyle = c.grid
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(mL.X(pr), mL.Y(-4.6))
  ctx.lineTo(mL.X(pr), mL.Y(4.6))
  ctx.stroke()
  ctx.setLineDash([])
  dot(ctx, mL.X(pr), mL.Y(pi), c.amber, 5)
  dot(ctx, mL.X(pr), mL.Y(-pi), c.amber, 5)
  // 原点到极点的连线
  poly(ctx, [[mL.X(0), mL.Y(0)], [mL.X(pr), mL.Y(pi)]], c.green, 1.6)
  label(ctx, pL.x + 12, pL.y + 28, `ζ = ${zeta.toFixed(2)}　σ = ${pr.toFixed(2)}`, '#ffd08a')
  label(ctx, pL.x + 12, pL.y + pL.h - 28, '实部为负 → 稳定', c.muted, 11)

  // 阶跃响应闭式解
  const wd = wn * Math.sqrt(Math.max(1e-9, 1 - zeta * zeta))
  const ys: number[] = []
  const pts: [number, number][] = []
  const M = 600
  for (let i = 0; i <= M; i++) {
    const x = (8 * i) / M
    const y = 1 - Math.exp(-zeta * wn * x) * (Math.cos(wd * x) + ((zeta * wn) / wd) * Math.sin(wd * x))
    ys.push(y)
    pts.push([mR.X(x), mR.Y(y)])
  }
  ctx.strokeStyle = c.green
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(mR.X(0), mR.Y(1))
  ctx.lineTo(mR.X(8), mR.Y(1))
  ctx.stroke()
  ctx.setLineDash([])
  poly(ctx, pts, c.blue, 2.2)
  // 超调必须从**数据数组**取，不能从像素坐标取——踩过一次：拿像素 Y 算出了 29661%
  const over = ys.reduce((mx, y) => Math.max(mx, y), 0)
  label(ctx, pR.x + 12, pR.y + 28, `超调 ≈ ${((over - 1) * 100).toFixed(0)}%`, '#7ef0bb')
}

function drawZMap(ctx: CanvasRenderingContext2D, c: Palette, sigma: number) {
  const T = 0.05
  const pL: Panel = { x: 24, y: 26, w: 388, h: 348 }
  const pR: Panel = { x: 448, y: 26, w: 388, h: 348 }
  panelRect(ctx, pL, c, 's 平面')
  panelRect(ctx, pR, c, 'z 平面')
  const mL = mapEq(pL, [-4.6, 1], [-2.2, 2.2])
  const mR = mapEq(pR, [-1.25, 1.25], [-1.25, 1.25])
  cross(ctx, mL, c)
  cross(ctx, mR, c)

  poly(ctx, [[mL.X(-sigma), mL.Y(-2)], [mL.X(-sigma), mL.Y(2)]], c.amber, 3)
  dot(ctx, mL.X(-sigma), mL.Y(0), '#ffd08a')
  label(ctx, pL.x + 12, pL.y + 28, `Re(s) = −${sigma.toFixed(2)}`, '#ffd08a')

  // 单位圆参考
  ctx.strokeStyle = c.border
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.arc(mR.X(0), mR.Y(0), mR.s, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  const R = Math.exp(-sigma * T)
  ctx.strokeStyle = c.green
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.arc(mR.X(0), mR.Y(0), R * mR.s, 0, Math.PI * 2)
  ctx.stroke()
  dot(ctx, mR.X(1), mR.Y(0), '#7ef0bb', 4)
  label(ctx, pR.x + 12, pR.y + 28, `|z| = e^(−σT) = ${R.toFixed(3)}`, '#7ef0bb')
  label(ctx, pR.x + 12, pR.y + pR.h - 28, '虚线＝单位圆（稳定域边界）', c.muted, 11)
}

function drawState(ctx: CanvasRenderingContext2D, c: Palette, gain: number, ksteps: number) {
  const dt = 0.02
  const A = [
    [-0.6, 2.0],
    [-2.0, -0.6],
  ]
  const B = [0, 1]
  const kk = [gain, 1.2]
  const pL: Panel = { x: 24, y: 26, w: 388, h: 348 }
  const pR: Panel = { x: 448, y: 26, w: 388, h: 348 }
  panelRect(ctx, pL, c, '状态轨迹（u = −kᵀx）')
  panelRect(ctx, pR, c, 'k 步内的可达方向')
  const mL = mapEq(pL, [-3.4, 3.4], [-3.4, 3.4])
  const mR = mapEq(pR, [-1.35, 1.35], [-1.35, 1.35])
  grid(ctx, pL, c)
  grid(ctx, pR, c)
  cross(ctx, mL, c)
  cross(ctx, mR, c)

  // 闭环：x' = (A − Bkᵀ)x
  const Acl = [
    [A[0][0] - B[0] * kk[0], A[0][1] - B[0] * kk[1]],
    [A[1][0] - B[1] * kk[0], A[1][1] - B[1] * kk[1]],
  ]
  let x = [2.6, 1.2]
  const traj: [number, number][] = [[mL.X(x[0]), mL.Y(x[1])]]
  for (let i = 0; i < 400; i++) {
    const dx0 = Acl[0][0] * x[0] + Acl[0][1] * x[1]
    const dx1 = Acl[1][0] * x[0] + Acl[1][1] * x[1]
    x = [x[0] + dt * dx0, x[1] + dt * dx1]
    traj.push([mL.X(x[0]), mL.Y(x[1])])
  }
  poly(ctx, traj, c.blue, 2)
  dot(ctx, traj[0][0], traj[0][1], '#ffd08a')
  dot(ctx, mL.X(0), mL.Y(0), c.green, 4)
  label(ctx, pL.x + 12, pL.y + 28, `反馈增益 g = ${gain.toFixed(2)}`, '#ffd08a')
  label(ctx, pL.x + 12, pL.y + pL.h - 28, '轨迹收敛到原点', c.muted, 11)

  // 可达方向：A^jB 的单位方向（±），按角度排序连成内接多边形
  const dirs: number[][] = []
  let v = [B[0], B[1]]
  for (let j = 0; j < ksteps; j++) {
    const nv = Math.hypot(v[0], v[1])
    if (nv > 1e-12) dirs.push([v[0] / nv, v[1] / nv])
    v = [Acl[0][0] * v[0] + Acl[0][1] * v[1], Acl[1][0] * v[0] + Acl[1][1] * v[1]]
  }
  const all: number[][] = []
  for (const d of dirs) {
    all.push(d)
    all.push([-d[0], -d[1]])
  }
  all.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]))
  if (all.length >= 3) {
    const poly1: [number, number][] = all.map((d) => [mR.X(d[0]), mR.Y(d[1])])
    ctx.fillStyle = c.green
    ctx.globalAlpha = 0.18
    ctx.beginPath()
    ctx.moveTo(poly1[0][0], poly1[0][1])
    for (let i = 1; i < poly1.length; i++) ctx.lineTo(poly1[i][0], poly1[i][1])
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
    poly(ctx, [...poly1, poly1[0]], c.green, 1.8)
  }
  dot(ctx, mR.X(0), mR.Y(0), '#7ef0bb', 4)
  label(ctx, pR.x + 12, pR.y + 28, `k = ${ksteps} 步`, '#7ef0bb')
  label(ctx, pR.x + 12, pR.y + pR.h - 28, '方向张开＝能控', c.muted, 11)
}

function drawLLN(ctx: CanvasRenderingContext2D, c: Palette, paths: number, step: number) {
  const p = 0.45
  const total = 200
  // 固定种子，保证每次渲染一致（否则读者刷新看到的路径不一样）
  // 用 Lehmer（模 2^31−1 的线性同余），乘积不超过 2^45，不会丢精度
  let seed = 20261124
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const pL: Panel = { x: 24, y: 26, w: 388, h: 348 }
  const pR: Panel = { x: 448, y: 26, w: 388, h: 348 }
  panelRect(ctx, pL, c, '单条样本路径 S(n)/n')
  panelRect(ctx, pR, c, `${paths} 条路径与其均值`)
  grid(ctx, pL, c)
  grid(ctx, pR, c)
  const mL = mapLin(pL, [1, total], [0, 1])
  const mR = mapLin(pR, [1, total], [0, 1])
  cross(ctx, mL, c)
  cross(ctx, mR, c)

  const N = Math.min(Math.max(step, 2), total)
  const series: number[][] = []
  for (let t = 0; t < paths; t++) {
    const arr: number[] = []
    let s = 0
    for (let n = 1; n <= N; n++) {
      s += rnd() < p ? 1 : 0
      arr.push(s / n)
    }
    series.push(arr)
  }
  // 期望线
  ctx.strokeStyle = c.green
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(mL.X(1), mL.Y(p))
  ctx.lineTo(mL.X(total), mL.Y(p))
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(mR.X(1), mR.Y(p))
  ctx.lineTo(mR.X(total), mR.Y(p))
  ctx.stroke()
  ctx.setLineDash([])

  const pts1: [number, number][] = series[0].map((y, i) => [mL.X(i + 1), mL.Y(y)])
  poly(ctx, pts1, c.blue, 2)

  const mean: number[] = []
  for (let i = 0; i < N; i++) {
    let s = 0
    for (const arr of series) s += arr[i]
    mean.push(s / series.length)
  }
  for (const arr of series) {
    const pts: [number, number][] = arr.map((y, i) => [mR.X(i + 1), mR.Y(y)])
    ctx.strokeStyle = c.blue
    ctx.globalAlpha = 0.4
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  const ptsM: [number, number][] = mean.map((y, i) => [mR.X(i + 1), mR.Y(y)])
  poly(ctx, ptsM, c.green, 2.6)
  label(ctx, pL.x + 12, pL.y + 28, `p = ${p}`, '#7ef0bb')
  label(ctx, pR.x + 12, pR.y + 28, '绿粗线＝均值 → p', '#7ef0bb')
  label(ctx, pR.x + 12, pR.y + pR.h - 28, '单条不收敛，均值收敛', c.muted, 11)
}

// ── 组件 ──────────────────────────────────────────────────────────────

export default function MathDemo({ kind, caption }: { kind: DemoKind; caption: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const params = PARAMS[kind]
  const [a, setA] = useState(() => params[0]?.def ?? params[0]?.min ?? 0)
  const [b, setB] = useState(() => params[1]?.def ?? params[1]?.min ?? 0)
  const [step, setStep] = useState(kind === 'law-of-large-numbers' ? 8 : 0)
  const [playing, setPlaying] = useState(false)

  const draw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (cv.width !== W * dpr) {
      cv.width = W * dpr
      cv.height = H * dpr
    }
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const c = palette()
    ctx.fillStyle = c.bg
    ctx.fillRect(0, 0, W, H)
    switch (kind) {
      case 'complex-mapping':
        drawComplex(ctx, c, a, b || 1)
        break
      case 'fourier-series':
        drawFourier(ctx, c, Math.round(a) || 1)
        break
      case 'laplace-poles':
        drawLaplace(ctx, c, a, b || 3)
        break
      case 'z-mapping':
        drawZMap(ctx, c, a)
        break
      case 'state-space':
        drawState(ctx, c, a, Math.round(b) || 20)
        break
      case 'law-of-large-numbers':
        drawLLN(ctx, c, Math.round(a) || 20, step)
        break
    }
  }, [kind, a, b, step])

  useEffect(() => {
    draw()
  }, [draw])

  // 大数定律：自动播放，逐帧把路径长度加长
  useEffect(() => {
    if (kind !== 'law-of-large-numbers') return
    if (!playing) return
    let n = step
    const tick = () => {
      n += 2
      if (n >= 200) {
        n = 200
        setStep(n)
        setPlaying(false)
        return
      }
      setStep(n)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [kind, playing, step])

  // 复映射：播放时让 θ 自己走
  useEffect(() => {
    if (kind !== 'complex-mapping' || !playing) return
    const id = window.setInterval(() => {
      setA((v) => (v >= 360 ? 0 : v + 1.5))
    }, 16)
    return () => window.clearInterval(id)
  }, [kind, playing])

  const isLLN = kind === 'law-of-large-numbers'
  const showPlay = kind === 'complex-mapping' || isLLN

  return (
    <figure className="prereq-demo">
      <div className="prereq-demo-canvas">
        <canvas ref={canvasRef} style={{ width: '100%', height: 'auto' }} aria-label={caption} role="img" />
      </div>

      <div className="prereq-demo-controls">
        {params.map((p) => {
          const value = p.key === 'a' ? a : b
          const set = p.key === 'a' ? setA : setB
          return (
            <label key={p.key} className="prereq-demo-param">
              <span className="prereq-demo-param-label">
                {p.label}
                <b>{p.fmt(value)}</b>
              </span>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={value}
                onChange={(e) => set(Number(e.target.value))}
                aria-label={p.label}
              />
            </label>
          )
        })}

        {showPlay && (
          <button
            type="button"
            className="prereq-demo-play"
            onClick={() => {
              if (isLLN) {
                if (!playing && step >= 200) setStep(4)
                setPlaying(!playing)
              } else {
                setPlaying(!playing)
              }
            }}
          >
            {playing ? '⏸ 暂停' : isLLN ? '▶ 重放' : '▶ 播放'}
          </button>
        )}

        {isLLN && (
          <span className="prereq-demo-readout">
            已画到第 <b>{step}</b> / 200 次试验
          </span>
        )}
      </div>

      <figcaption className="text-sm text-text-muted leading-relaxed">{caption}</figcaption>
    </figure>
  )
}
