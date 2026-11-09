import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MathBlock from '../components/MathBlock'
import InlineMath from '../components/InlineMath'
import Callout from '../components/Callout'
import BodeChart from '../components/BodeChart'
import {
  computeTustin, frequencyResponse, errorAt, differenceEquation,
  parseSeries, presetCoefficients, fmt, texPoly, texNeg, PRESETS,
} from '../lib/tustin-core.mjs'

const M = InlineMath
const PRESET_KEYS = ['lead', 'pi', 'pd', 'pid']
const NUM_COLOR = '#9aa0a6'   // 连续基准
const DEN_COLOR = '#14b8a6'   // 离散 Tustin

function nz(x: number) {
  return Math.abs(x) < 1e-6 ? '0' : fmt(x, 3)
}

// 首屏默认值必须与「超前补偿」预置完全一致。原静态站的 HTML 里两个字段都写
// 3.97887e-7，靠 DOMContentLoaded 的 setPreset('lead') 覆盖；React 没有这一步，
// 故直接从同一个预置函数取值，避免首屏显示与预置不一致的假数据。
const LEAD = presetCoefficients('lead')!

export default function Tustin() {
  const [numStr, setNumStr] = useState(LEAD.num.map((v) => fmt(v, 6)).join(', '))
  const [denStr, setDenStr] = useState(LEAD.den.map((v) => fmt(v, 6)).join(', '))
  const [tsUs, setTsUs] = useState('1')
  const [fpKhz, setFpKhz] = useState('200')
  const [delayStr, setDelayStr] = useState('0')
  const [preset, setPreset] = useState('lead')

  const model = useMemo(() => {
    const num = parseSeries(numStr)
    const den = parseSeries(denStr)
    const ts = parseFloat(tsUs)
    const fpK = parseFloat(fpKhz)
    const delay = parseFloat(delayStr) || 0
    const valid = num.length > 0 && den.length > 0 && den.some((v) => Math.abs(v) > 1e-15)
      && isFinite(ts) && ts > 0
    if (!valid) return { valid: false as const }
    const params = {
      num, den,
      T: ts * 1e-6,
      fp: isFinite(fpK) ? Math.max(0, fpK) * 1e3 : 0,
      delay,
    }
    const computed = computeTustin(params)
    const fr = frequencyResponse(params, computed)
    const errFw = params.fp > 0 ? errorAt(params, computed, params.fp) : null
    const errNy = errorAt(params, computed, computed.fs / 2 * 0.999)
    return {
      valid: true as const, params, computed, fr, errFw, errNy,
      diffEq: differenceEquation(computed.b, computed.a_coef),
      tfC: `G_c(s)=\\frac{${texPoly(num, 's')}}{${texPoly(den, 's')}}`,
      tfD: `G_{cd}(z)=\\frac{${texNeg(computed.b)}}{${texNeg(computed.a_coef)}}`,
      subst: `s\\rightarrow ${fmt(computed.k, 4)}\\cdot\\frac{2}{T}\\frac{z-1}{z+1}`
        + `\\;=\\;${fmt(computed.a_eff, 4)}\\cdot\\frac{z-1}{z+1},\\quad T=${fmt(params.T * 1e6, 4)}\\,\\mu s`,
    }
  }, [numStr, denStr, tsUs, fpKhz, delayStr])

  const magSeries = useMemo(() => model.valid ? [
    { y: model.fr.mag, color: NUM_COLOR, width: 2 },
    { y: model.fr.magD, color: DEN_COLOR, width: 2.2 },
  ] : [], [model])
  const phaSeries = useMemo(() => model.valid ? [
    { y: model.fr.pha, color: NUM_COLOR, width: 2 },
    { y: model.fr.phaD, color: DEN_COLOR, width: 2.2 },
  ] : [], [model])

  function applyPreset(key: string) {
    setPreset(key)
    if (key === 'custom') return
    const r = presetCoefficients(key)
    if (!r) return
    setNumStr(r.num.map((v) => fmt(v, 6)).join(', '))
    setDenStr(r.den.map((v) => fmt(v, 6)).join(', '))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold">Tustin / 预畸变 计算器</h1>
        <p className="text-text-muted mt-2">对任意 <M latex="D(s)" /> 的每一处 <M latex="s" /> 做替换，实时看它与原连续系统差多少。</p>
      </div>

      {/* ── 输入 ── */}
      <div className="panel mt-8">
        <div className="flex flex-wrap gap-2">
          {PRESET_KEYS.map((key) => (
            <button key={key} className={`chip ${preset === key ? 'on' : ''}`} onClick={() => applyPreset(key)}>
              {PRESETS[key].label}
            </button>
          ))}
          <button className={`chip ${preset === 'custom' ? 'on' : ''}`} onClick={() => applyPreset('custom')}>自定义</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div className="field">
            <label htmlFor="in-num">分子系数（按 s 升幂，逗号分隔）</label>
            <input id="in-num" className="input-field" value={numStr} spellCheck={false}
              onChange={(e) => { setNumStr(e.target.value); setPreset('custom') }} />
            <span className="hint">例：1 + s/ωz → <code>1, 1/ωz</code></span>
          </div>
          <div className="field">
            <label htmlFor="in-den">分母系数（按 s 升幂，逗号分隔）</label>
            <input id="in-den" className="input-field" value={denStr} spellCheck={false}
              onChange={(e) => { setDenStr(e.target.value); setPreset('custom') }} />
            <span className="hint">例：s → <code>0, 1</code></span>
          </div>
          <div className="field">
            <label htmlFor="in-ts">采样周期 T（µs）</label>
            <input id="in-ts" className="input-field" type="number" step="0.1" min="0.001" value={tsUs}
              onChange={(e) => setTsUs(e.target.value)} />
            <span className="hint">T = 1 µs ⇒ fs = 1 MHz</span>
          </div>
          <div className="field">
            <label htmlFor="in-fp">预畸变频率 f<sub>w</sub>（kHz，0 = 关闭）</label>
            <input id="in-fp" className="input-field" type="number" step="10" min="0" value={fpKhz}
              onChange={(e) => setFpKhz(e.target.value)} />
            <span className="hint">Erickson 例：取 √(fz·fp) = 200 kHz</span>
          </div>
          <div className="field">
            <label htmlFor="in-delay">附加延时（采样周期数）</label>
            <input id="in-delay" className="input-field" type="number" step="0.5" min="0" value={delayStr}
              onChange={(e) => setDelayStr(e.target.value)} />
            <span className="hint">ZOH 平均 0.5 拍；数字计算常见 1～1.5 拍</span>
          </div>
        </div>
      </div>

      {!model.valid ? (
        <div className="panel text-danger text-sm">分子/分母系数或采样周期无效：分母不能全为零，T 必须大于 0。请修正输入。</div>
      ) : (
        <>
          {/* ── 读数 ── */}
          <div className="readout">
            <div className="ro"><div className="k">采样频率 fs</div><div className="v">{fmt(model.computed.fs / 1e3, 5)} kHz</div></div>
            <div className="ro"><div className="k">预畸变系数 k</div><div className="v">{model.params.fp > 0 ? fmt(model.computed.k, 5) : '1（关闭）'}</div></div>
            <div className="ro"><div className="k">有效替换系数 a</div><div className="v">{fmt(model.computed.a_eff, 6)}</div></div>
            <div className="ro"><div className="k">校核频率 fw</div><div className="v">{model.params.fp > 0 ? `${fmt(model.params.fp / 1e3, 4)} kHz` : '—'}</div></div>
            <div className="ro"><div className="k">fw 处偏差（幅/相）</div><div className="v">{model.errFw ? `${nz(model.errFw.dB)} dB / ${nz(model.errFw.ph)}°` : '—'}</div></div>
            <div className="ro"><div className="k">fs/2 处偏差（幅/相）</div><div className="v">{model.errNy ? `${nz(model.errNy.dB)} dB / ${nz(model.errNy.ph)}°` : '—'}</div></div>
          </div>

          {/* ── 替换式与传递函数 ── */}
          <div className="panel">
            <div className="panel-label">替换式</div>
            <MathBlock latex={model.subst} />
            <div className="panel-label mt-4">连续 → 离散</div>
            <MathBlock latex={model.tfC} />
            <MathBlock latex={model.tfD} />
            <div className="panel-label mt-4">差分方程（可直接写进 DSP）</div>
            <pre className="eq-pre">{model.diffEq}</pre>
          </div>

          {/* ── 频响 ── */}
          <div className="panel">
            <div className="panel-label">幅频响应</div>
            <BodeChart
              fmin={model.fr.fmin} fmax={model.fr.fmax} series={magSeries}
              ymin={-60} ymax={40} ticks={20} ylabel="|G| / dB"
              marker={model.params.fp > 0 ? model.params.fp : null} height={230}
            />
            <div className="legend">
              <span><i style={{ borderColor: NUM_COLOR }} />连续 Gc(s)（基准）</span>
              <span><i style={{ borderColor: DEN_COLOR }} />离散 Gcd(z)（Tustin）</span>
              <span className="text-accent-light">虚线 = 奈奎斯特频率 fs/2</span>
              <span className="text-primary-light">绿虚线 = 预畸变校核点 fw</span>
            </div>

            <div className="panel-label mt-8">相频响应</div>
            <BodeChart
              fmin={model.fr.fmin} fmax={model.fr.fmax} series={phaSeries}
              ymin={-180} ymax={180} ticks={90} ylabel="∠G / °"
              marker={model.params.fp > 0 ? model.params.fp : null} height={200}
            />
            <div className="legend">
              <span><i style={{ borderColor: NUM_COLOR }} />∠Gc</span>
              <span><i style={{ borderColor: DEN_COLOR }} />∠Gcd</span>
            </div>
          </div>

          {/* ── 说明 ── */}
          <Callout type="note" label="怎么读这个图">
            <p>
              把「预畸变」关掉（f<sub>w</sub> = 0），你会看到蓝线在奈奎斯特频率附近偏离灰线。
              默认算例（超前补偿 f<sub>z</sub>=100 kHz、f<sub>p</sub>=400 kHz、fs=1 MHz）下，
              <b>fs/2 处偏差约 2 dB / 27°</b>——把 T 调到 2 µs 再试，这个偏差会迅速放大。
            </p>
            <p>
              再把 f<sub>w</sub> 设成你关心的转折频率（默认 200 kHz），蓝线会在该点<b>与灰线精确重合</b>
              （读数应显示 <code>0 dB / 0°</code>），但低频段会略微错开。这是<b>用低频精度换高频精度</b>的交易，不是免费的。
            </p>
          </Callout>

          <Callout type="ok" label="再试一步">
            <p>
              把「附加延时」从 0 改成 1 拍，蓝线的相位整体再往下压——这就是数字环路比模拟环路多出来的那一项{' '}
              <M latex="e^{-st_d}" />。相位裕度就是这样被吃掉的。
            </p>
          </Callout>

          <Callout type="warn" label="口径">
            <p>
              本工具按 <M latex="s\to k\cdot\frac{2}{T}\frac{z-1}{z+1}" /> 计算，
              <M latex="k=\frac{\omega_w T/2}{\tan(\omega_w T/2)}" />。
              幅相为理想模型值，不含量化、饱和、抗混叠滤波器与器件非线性。
              计算内核是独立模块 <code>src/lib/tustin-core.mjs</code>，可脱离页面单独复核。
            </p>
          </Callout>

          <div className="panel">
            <div className="panel-label">公式出处</div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Tustin 替换：卢京潮《自动控制原理》式(6-77)、Franklin《自动控制原理与设计》p.136、
              Erickson《Fundamentals of Power Electronics》式(19.35)。预畸变系数：Erickson 式(19.48)。
            </p>
            <p className="text-sm text-text-muted mt-2">
              纯客户端计算，无网络请求。推导脉络见 <Link to="/learn/s-to-z" className="text-primary-light hover:underline">从 S 变换到 Z 变换 §4–§5.4</Link>。
            </p>
          </div>
        </>
      )}
    </div>
  )
}
