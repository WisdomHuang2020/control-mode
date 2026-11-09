import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Layers, Route, ShieldCheck } from 'lucide-react'
import RichText from '../components/RichText'
import { BAND_DESC, BAND_ORDER, CHAPTERS, HANDBOOK_STATS, chapterBySlug, DIFFICULTY_LABEL } from '../data/handbook'

function Dots({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-[3px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= n ? 'bg-primary-light' : 'bg-border'}`} />
      ))}
    </span>
  )
}

/** 读法：不同目的走不同路径，避免「从第 1 阶老老实实读到第 18 阶」这种劝退式入口。 */
const PATHS: { name: string; desc: string; slugs: string[] }[] = [
  {
    name: '最短可用路径',
    desc: '只想把手上的环路调稳：跳过建模推导，直接要结论与数字。',
    slugs: ['feedback-loop', 'topologies', 'transfer-functions', 'loop-compensation'],
  },
  {
    name: '闭环设计路径',
    desc: '要完整设计一个环路：拓扑 → 边界 → 建模 → 补偿 → 仿真 → 灵敏度与闭环性能。',
    slugs: [
      'feedback-loop',
      'topologies',
      'ccm-dcm',
      'small-signal',
      'state-space-averaging',
      'averaged-switch-model',
      'transfer-functions',
      'loop-compensation',
      'simulation',
      'sensitivity',
      'closed-loop-performance',
    ],
  },
  {
    name: '追根究底路径',
    desc: '要把模型推一遍、看懂每个零极点的来路：全 18 阶，含电流模式、数字控制与现代控制。',
    slugs: CHAPTERS.map((c) => c.slug),
  },
]

export default function Handbook() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="max-w-3xl">
        <div className="font-mono text-xs tracking-[0.2em] text-primary-light uppercase mb-4">
          HANDBOOK · {HANDBOOK_STATS.chapters} 阶
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">建模与控制手册</h1>
        <p className="mt-3 text-text-secondary leading-relaxed">
          前 12 阶是一条主线：从「开关电源在控什么」一路推到 MPC，一阶比一阶难一点。
          后 6 阶是专题：根轨迹、灵敏度、闭环性能、模型边界、饱和、前馈——
          都是前面一笔带过、工程上却一定会撞到的地方。
          每章都给一句话直觉、核心公式、常见误区和两道自测，末尾标出它在知识库里的出处。
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary-light" /> {HANDBOOK_STATS.chapters} 章 · {BAND_ORDER.length} 个阶段
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary-light" /> {HANDBOOK_STATS.formulas} 条公式 · {HANDBOOK_STATS.tables} 张对照表
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary-light" /> 通读约 {Math.round(HANDBOOK_STATS.minutes / 60)} 小时
          </span>
        </div>
      </header>

      <div className="section-h">
        <h2>三条读法</h2>
        <div className="line" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PATHS.map((p) => (
          <div key={p.name} className="card-surface feature-card">
            <div className="k">
              <Route className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
              PATH
            </div>
            <h3>{p.name}</h3>
            <p>{p.desc}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.slugs.map((s) => {
                const c = chapterBySlug(s)
                if (!c) return null
                return (
                  <Link
                    key={s}
                    to={`/handbook/${s}`}
                    className="rounded-md border border-border px-2 py-1 font-mono text-[11px] text-text-secondary hover:border-primary-light hover:text-primary-light transition-colors"
                  >
                    {c.level}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {BAND_ORDER.map((band) => {
        const list = CHAPTERS.filter((c) => c.band === band)
        const from = list[0]?.level
        const to = list[list.length - 1]?.level
        return (
          <section key={band}>
            <div className="section-h">
              <h2>
                {band} · 第 {from}–{to} 阶
              </h2>
              <div className="line" />
            </div>
            <p className="text-sm text-text-muted -mt-2 mb-4">{BAND_DESC[band]}</p>
            <div className="space-y-3">
              {list.map((c) => (
                <Link
                  key={c.slug}
                  to={`/handbook/${c.slug}`}
                  className="group flex gap-4 rounded-xl border border-border bg-surface p-4 hover:border-primary-light transition-colors"
                >
                  <div className="shrink-0 w-10 pt-0.5 text-center">
                    <div className="font-mono text-lg font-semibold text-primary-light leading-none">{c.level}</div>
                    <div className="mt-1 text-[10px] text-text-muted">阶</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-text-primary flex items-center gap-2 flex-wrap">
                      {c.title}
                      <Dots n={c.difficulty} />
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary"><RichText text={c.tagline} /></p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
                      <span>{DIFFICULTY_LABEL[c.difficulty]}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {c.minutes} 分钟
                      </span>
                      <span className="font-mono">{c.goal.length} 项目标 · {c.quiz.length} 道自测</span>
                    </div>
                  </div>
                  <ArrowRight className="shrink-0 w-4 h-4 text-text-muted group-hover:text-primary-light transition-colors self-center" />
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      <div className="section-h">
        <h2>这本手册的口径</h2>
        <div className="line" />
      </div>
      <div className="card-surface p-6 text-sm leading-relaxed text-text-secondary space-y-3">
        <p>
          <strong>每章都是同一个结构</strong>：一句话直觉 → 需要三层递进的概念 → 公式 → 对照表 → 常见误区 →
          自测 → 出处。结构统一是为了让你能跳读，而不是每次重新适应版式。
        </p>
        <p>
          <strong>公式只写工程上真会用到的那一版</strong>，推导省略的会在正文里说「这一步省了什么」。
          想看逐条推导与原文对照，去长篇专题页。
        </p>
        <p>
          <strong>出处只标到节号</strong>，因为知识库检索能回溯到块与页码；反过来把页码印死在页面里，
          换一版书就全错了。本页不写「一般认为」，写不出出处的结论就不写。
        </p>
        <p>
          <strong>范围只到建模与控制。</strong>磁性元件设计、EMI 与布局、热设计、可靠性工程不在本手册里——
          它们很重要，但不是这套书的主线，写成半章只会误导。同理，讲拓扑也只讲到「能推出传递函数」为止。
          想看这些方向，得另找文献，别指望这本手册给半吊子的答案。
        </p>
      </div>
    </div>
  )
}
