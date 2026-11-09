import { useEffect, useRef } from 'react'
import { THEME_EVENT, readThemeColors } from '../theme'

export interface BodeSeries {
  y: number[]
  color: string
  width: number
}

interface BodeChartProps {
  fmin: number
  fmax: number
  series: BodeSeries[]
  ymin: number
  ymax: number
  ticks: number
  ylabel: string
  marker?: number | null
  height?: number
}

/**
 * 幅相频响图。由原站 js/tustin.js 的 plot() 迁移。
 * 配色取自当前主题变量（`readThemeColors()`），切换 8 套主题后自动重绘；
 * 曲线颜色由调用方传入，Tustin 页同样按主题变量派生。
 * 计算数据全部由纯函数模块 tustin-core 生成，本组件只负责绘制，不含任何数值逻辑。
 */
export default function BodeChart({
  fmin, fmax, series, ymin, ymax, ticks, ylabel, marker = null, height = 230,
}: BodeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const draw = () => {
      const cv = canvasRef.current
      if (!cv) return
      const C = readThemeColors()
      const dpr = window.devicePixelRatio || 1
      const W = cv.clientWidth || 800
      const H = height
      cv.width = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
      cv.style.height = `${H}px`
      const ctx = cv.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const padL = 58, padR = 18, padT = 14, padB = 26
      const iw = W - padL - padR, ih = H - padT - padB
      ctx.clearRect(0, 0, W, H)

      const lf0 = Math.log10(fmin), lf1 = Math.log10(fmax)
      const X = (f: number) => padL + (Math.log10(f) - lf0) / (lf1 - lf0) * iw
      const Y = (v: number) => padT + ih - (v - ymin) / (ymax - ymin) * ih

      ctx.strokeStyle = C.grid
      ctx.lineWidth = 1
      ctx.font = '11px ui-monospace, Consolas, monospace'

      for (let v = ymin; v <= ymax + 1e-9; v += ticks) {
        const y = Y(v)
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + iw, y); ctx.stroke()
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        ctx.fillStyle = C.muted
        ctx.fillText(String(v), padL - 8, y)
      }
      for (let d = Math.ceil(lf0); d <= Math.floor(lf1); d++) {
        const fx = Math.pow(10, d)
        const x = X(fx)
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ih); ctx.stroke()
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        const lbl = fx >= 1e6 ? `${fx / 1e6}M` : fx >= 1e3 ? `${fx / 1e3}k` : String(fx)
        ctx.fillStyle = C.muted
        ctx.fillText(lbl, x, padT + ih + 6)
      }

      // 奈奎斯特频率
      const xny = X(fmax)
      ctx.strokeStyle = C.accent
      ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(xny, padT); ctx.lineTo(xny, padT + ih); ctx.stroke()
      ctx.setLineDash([])
      ctx.textAlign = 'right'; ctx.textBaseline = 'top'
      ctx.fillStyle = C.accentLight
      ctx.fillText('fs/2', padL + iw, padT + 2)

      // 预畸变校核点
      if (marker && marker > fmin && marker < fmax) {
        const xm = X(marker)
        ctx.strokeStyle = C.primaryLight
        ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.moveTo(xm, padT); ctx.lineTo(xm, padT + ih); ctx.stroke()
        ctx.setLineDash([])
        ctx.textAlign = 'center'; ctx.fillStyle = C.primaryLight
        ctx.fillText('fw', xm, padT + 2)
      }

      ctx.fillStyle = C.muted
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.font = "11.5px Inter, system-ui, 'Segoe UI', sans-serif"
      ctx.fillText(ylabel, padL - 52, 0)

      ctx.save()
      ctx.beginPath(); ctx.rect(padL, padT - 1, iw, ih + 2); ctx.clip()
      for (const s of series) {
        ctx.beginPath()
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width
        for (let i = 0; i < s.y.length; i++) {
          const f = fmin * Math.pow(fmax / fmin, i / (s.y.length - 1))
          const px = X(f), py = Y(Math.max(Math.min(s.y[i], ymax), ymin))
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      ctx.restore()

      ctx.strokeStyle = C.frame; ctx.lineWidth = 1
      ctx.strokeRect(padL, padT, iw, ih)
    }

    draw()
    window.addEventListener('resize', draw)
    // 切换 8 套主题后按新变量重绘（canvas 不会自动跟随 CSS 变量）
    window.addEventListener(THEME_EVENT, draw)
    return () => {
      window.removeEventListener('resize', draw)
      window.removeEventListener(THEME_EVENT, draw)
    }
  }, [fmin, fmax, series, ymin, ymax, ticks, ylabel, marker, height])

  return <canvas ref={canvasRef} className="w-full block" aria-label="幅相频响对比图" role="img" />
}
