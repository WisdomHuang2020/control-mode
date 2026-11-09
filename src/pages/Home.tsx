import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, BookOpen, Calculator, Search, ShieldCheck, GitBranch, Library } from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
}

const entries = [
  {
    to: '/handbook', k: 'HANDBOOK · 01', icon: Library, title: '建模与控制手册',
    desc: '18 阶、5 个阶段：前 12 阶从「开关电源在控什么」一路走到 MPC，后 6 阶是专题——根轨迹、灵敏度、闭环性能、模型边界、饱和与抗饱和、前馈。每章一句话直觉 + 核心公式 + 对照表 + 常见误区 + 两道自测，末尾标出知识库出处。嫌长篇太厚，从这本开始。',
    status: '已上线 · 18 阶',
  },
  {
    to: '/learn/s-to-z', k: 'TRAINING · 01', icon: BookOpen, title: '从 S 变换到 Z 变换',
    desc: '采样为什么把拉普拉斯变成 z 变换、s 平面如何折叠进单位圆、四种离散化方法各自的来路与代价。全部结论附《自动控制原理（卢京潮）》《自动控制原理与设计》《Fundamentals of Power Electronics》原文坐标。',
    status: '已上线 · 7 节',
  },
  {
    to: '/tools/tustin', k: 'TOOL · 01', icon: Calculator, title: 'Tustin / 预畸变 计算器',
    desc: '输入任意 D(s)，实时给出离散 D(z)、差分方程与幅相频响对比。可切换 Tustin / 带预畸变、可叠加计算延时，直接看相位裕度被吃掉多少。',
    status: '已上线 · 可交互',
  },
]

const principles = [
  { icon: ShieldCheck, k: 'PRINCIPLE', title: '结论可溯源', desc: '不写「一般认为」，写「卢京潮 p.279 式(6-77)」。库里没有的就说没有。' },
  { icon: GitBranch, k: 'PRINCIPLE', title: '计算可复核', desc: '工具的计算内核是独立模块 src/lib/tustin-core.mjs，可脱离页面用 Node 单独跑一遍核对，不藏在黑箱里。' },
  { icon: Search, k: 'PRINCIPLE', title: '边界写清楚', desc: '模型能算什么、不能算什么，写在页面底部，而不是等你算错了才发现。' },
]

export default function Home() {
  // 尊重系统「减少动态效果」：开启时跳过入场动画，直接呈现最终状态
  const reduceMotion = useReducedMotion()
  const initialState = reduceMotion ? false : 'hidden'

  return (
    <div>
      {/* Hero：背景网格与站群其它 React 站同源（LLC Home 的 HeroCircuitBackground） */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <svg className="w-full h-full opacity-[0.08]" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" className="text-primary-light" />
          </svg>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-28">
          <motion.div custom={0} initial={initialState} animate="visible" variants={fadeUp}>
            <div className="font-mono text-xs tracking-[0.2em] text-primary-light uppercase mb-5">
              Power Electronics · Modeling &amp; Control
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight max-w-3xl">
              把书里的公式，变成<span className="text-gradient">能动手算的工具</span>
            </h1>
            <p className="mt-6 text-text-secondary text-base md:text-lg leading-relaxed max-w-3xl">
              43 份资料（教材、专著、论文与厂商应用笔记混编）→ 17,292 个可检索文本块 → 可溯源的培训页与可复核的计算工具。
              每个结论都标着它出自哪本书、哪一节；页码不写死，靠知识库检索回溯。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/learn/s-to-z" className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-light px-5 py-2.5 text-sm font-semibold text-white transition-colors">
                <BookOpen className="w-4 h-4" /> 开始阅读：从 S 变换到 Z 变换
              </Link>
              <Link to="/tools/tustin" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated hover:border-primary-light px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors">
                <Calculator className="w-4 h-4" /> 打开 Tustin 计算器
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="section-h"><h2>从哪里开始</h2><div className="line" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {entries.map((e, i) => (
            <motion.div key={e.to} custom={i} initial={initialState} animate="visible" variants={fadeUp}>
              <Link to={e.to} className="card-surface feature-card h-full block hover:no-underline">
                <div className="k">{e.k}</div>
                <h3 className="flex items-center gap-2"><e.icon className="w-4 h-4 text-primary-light" />{e.title}</h3>
                <p>{e.desc}</p>
                <span className="status">{e.status}</span>
              </Link>
            </motion.div>
          ))}
          <motion.div custom={2} initial={initialState} animate="visible" variants={fadeUp}>
            <div className="card-surface feature-card dim h-full">
              <div className="k">SEARCH · 02</div>
              <h3 className="flex items-center gap-2"><Search className="w-4 h-4" />全库检索</h3>
              <p>17,292 块文本 + 20,596 条公式的跨书检索。当前索引是 133 MB 的服务端格式，正在重编码为可上线的分片格式。</p>
              <span className="status">规划中</span>
            </div>
          </motion.div>
        </div>

        <div className="section-h"><h2>为什么是这样做的</h2><div className="line" /></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {principles.map((p) => (
            <div key={p.title} className="card-surface feature-card">
              <div className="k">{p.k}</div>
              <h3 className="flex items-center gap-2"><p.icon className="w-4 h-4 text-primary-light" />{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>

        <div className="section-h" id="scope"><h2>本轮预览的范围</h2><div className="line" /></div>
        <div className="card-surface p-6">
          <p className="text-text-secondary leading-relaxed"><strong className="text-text-primary">已经做的：</strong>手册 18 阶 / 5 个阶段（建模与控制的完整主线 + 6 个专题）、S→Z 长篇专题 1 篇（逐条公式溯源）、Tustin 计算器 1 个（内核可单独复核）。</p>
          <p className="text-text-secondary leading-relaxed mt-3"><strong className="text-text-primary">范围与还没做的：</strong>本手册只覆盖建模与控制，磁性元件设计、EMI 与布局、热设计、可靠性工程不在范围内。知识库 20,596 条公式只用到约 120 条，7,522 张书内插图一张未用；跨书检索（17,292 块）尚未开放成可交互页面。这些不是「即将上线」，是没有排期。</p>
          <div className="mt-5 pt-5 border-t border-border text-sm text-text-muted leading-relaxed">
            技术栈与站群一致：Vite + React + TypeScript + Tailwind CSS；公式由 KaTeX 本地打包，无 CDN 依赖；
            计算内核为独立模块，页面与内核可分别复核。
          </div>
        </div>

        <div className="mt-10 flex items-center gap-2 text-sm text-text-muted">
          <ArrowRight className="w-4 h-4" />
          <Link to="/handbook" className="text-primary-light hover:underline">从手册第 1 阶开始读</Link>
        </div>
      </div>
    </div>
  )
}
