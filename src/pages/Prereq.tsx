import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Film, GraduationCap, Image as ImageIcon, Sigma, Sparkles } from 'lucide-react'
import RichText from '../components/RichText'
import { PREREQ_CHAPTERS, PREREQ_STATS } from '../data/prereq'
import { BOOK_CMATH, BOOK_MODERN, EXTERNAL_NOTE } from '../data/prereq/types'

/**
 * 前置知识地图页。
 *
 * 口径（这页必须写清楚，否则读者会把外部书当成本站知识库的一部分）：
 *   ① 两本书是**外部资料，未入本站知识库**，不计入首页那套「43 份资料 / 17,292 块」；
 *   ② 插图是书内原图，标注图号与节号；
 *   ③ 视频与交互图是**本站自制**，标注所依据的书内节号，不冒充原书插图。
 */
export default function Prereq() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="max-w-3xl">
        <div className="font-mono text-xs tracking-[0.2em] text-primary-light uppercase mb-4">
          PREREQUISITES · {PREREQ_STATS.chapters} 章
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">前置知识：把手册里默认你会的那部分数学补上</h1>
        <p className="mt-3 text-text-secondary leading-relaxed">
          <RichText text="手册第 1 阶开始讲「开关电源在控什么」，但从第 7 阶起会直接用到复平面、传递函数、采样定理、范数与随机过程。这些前置条件散落在两本数学教材里，书里写得很全，但**结构是隐性的**——你得自己把「这一章会用到哪一条」拼出来。这一模块做的就是这件事：把隐性的依赖关系显性化，配书内原图、动态视频与可交互的图。" />
        </p>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-primary-light" /> {PREREQ_STATS.chapters} 章 · 通读约{' '}
            {Math.round(PREREQ_STATS.minutes / 60)} 小时
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sigma className="w-4 h-4 text-primary-light" /> {PREREQ_STATS.formulas} 条公式 · {PREREQ_STATS.tables} 张表
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-primary-light" /> {PREREQ_STATS.figures} 张书内插图
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Film className="w-4 h-4 text-primary-light" /> {PREREQ_STATS.videos} 段视频 · {PREREQ_STATS.demos} 个交互组件
          </span>
        </div>
      </header>

      <div className="section-h">
        <h2>两本源书</h2>
        <div className="line" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-surface p-5">
          <div className="font-mono text-[10px] tracking-[0.12em] text-primary-light uppercase mb-2">SOURCE · 01</div>
          <h3 className="font-semibold text-text-primary mb-2">{BOOK_CMATH}</h3>
          <p className="text-sm leading-relaxed text-text-secondary">
            马洁、付兴建 主编，清华大学出版社。本站取用其复变函数基础（第 2 章）、
            傅里叶变换（第 4 章）、拉普拉斯变换（第 5 章）与 z 变换（第 6 章）。
          </p>
        </div>
        <div className="card-surface p-5">
          <div className="font-mono text-[10px] tracking-[0.12em] text-primary-light uppercase mb-2">SOURCE · 02</div>
          <h3 className="font-semibold text-text-primary mb-2">{BOOK_MODERN}</h3>
          <p className="text-sm leading-relaxed text-text-secondary">
            程代展、赵寅 编著。本站取用其赋范线性空间与有界线性算子（第 3 章）、
            概率论与随机过程（第 4、5 章）。
          </p>
        </div>
      </div>

      <div className="section-h">
        <h2>六章，按依赖顺序</h2>
        <div className="line" />
      </div>
      <div className="space-y-3">
        {PREREQ_CHAPTERS.map((c) => (
          <Link
            key={c.slug}
            to={`/math/${c.slug}`}
            className="group flex gap-4 rounded-xl border border-border bg-surface p-4 hover:border-primary-light transition-colors"
          >
            <div className="shrink-0 w-10 pt-0.5 text-center">
              <div className="font-mono text-lg font-semibold text-primary-light leading-none">{c.order}</div>
              <div className="mt-1 text-[10px] text-text-muted">章</div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-text-primary flex items-center gap-2 flex-wrap">
                {c.title}
                <span className="tag v">{c.tool}</span>
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">{c.tagline}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {c.minutes} 分钟
                </span>
                <span className="font-mono">{c.goal.length} 项目标 · {c.quiz.length} 道自测</span>
                <span className="font-mono">{c.sources.length} 条出处</span>
              </div>
            </div>
            <ArrowRight className="shrink-0 w-4 h-4 text-text-muted group-hover:text-primary-light transition-colors self-center" />
          </Link>
        ))}
      </div>

      <div className="section-h">
        <h2>这一模块的口径</h2>
        <div className="line" />
      </div>
      <div className="card-surface p-6 text-sm leading-relaxed text-text-secondary space-y-3">
        <p>
          <RichText text="**书内原图与本站自制素材是分开标注的。** 标「书内原图」的图片来自两本教材的插图，后面跟图号与节号，可以直接翻书对页；标「本站自制教学素材」的动画与交互图是本站按书中公式重新渲染的，后面跟的是它依据的书内节号。两者不会混在一起。" />
        </p>
        <p>
          <RichText text={`**出处给到节号与式号，不给页码。** ${EXTERNAL_NOTE}`} />
        </p>
        <p>
          <RichText text={`**不计入知识库统计。** 这两本书是外部资料，没有进入本站的 RAG 库，所以本页的 ${PREREQ_STATS.formulas} 条公式、${PREREQ_STATS.figures} 张插图都不能和首页那套「43 份资料 / 17,292 个文本块 / 20,596 条公式」相加。`} />
        </p>
        <p>
          <RichText text="**写不出出处的结论不写。** 例如「卡尔曼滤波」在两本书的正文里检索不到对应条目（该书用英文名 Kalman，位于 §5.5），所以这一模块只引用它对「好估计」的三个定义与 Wiener 过程，不给递推式，也不代写推导。" />
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-text-muted">
        <Sparkles className="w-4 h-4 text-primary-light" />
        <span>学完这六章，直接进</span>
        <Link to="/handbook" className="text-primary-light hover:underline">
          建模与控制手册第 1 阶
        </Link>
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </div>
  )
}
