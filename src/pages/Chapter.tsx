import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookMarked, Clock, Lightbulb, Target } from 'lucide-react'
import Callout from '../components/Callout'
import MathBlock from '../components/MathBlock'
import RichText from '../components/RichText'
import { DIFFICULTY_LABEL, chapterBySlug, chapterNeighbors, CHAPTERS } from '../data/handbook'
import type { Block } from '../data/handbook'

/** 难度用五个点表示，比写「难度 4/5」更快看懂。 */
function DifficultyDots({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label={`难度 ${n}/5：${DIFFICULTY_LABEL[n]}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= n ? 'bg-primary-light' : 'bg-border'}`}
        />
      ))}
    </span>
  )
}

function renderBlock(b: Block, i: number) {
  switch (b.t) {
    case 'p':
      return (
        <p key={i}>
          <RichText text={b.x} />
        </p>
      )
    case 'h':
      return (
        <h3 key={i} id={`h-${i}`}>
          <RichText text={b.x} />
        </h3>
      )
    case 'f':
      return (
        <div key={i}>
          <MathBlock latex={b.latex} />
          {b.note && <p className="source -mt-2">{b.note}</p>}
        </div>
      )
    case 'list':
      return b.ordered ? (
        <ol key={i}>
          {b.items.map((it, k) => (
            <li key={k}>
              <RichText text={it} />
            </li>
          ))}
        </ol>
      ) : (
        <ul key={i}>
          {b.items.map((it, k) => (
            <li key={k}>
              <RichText text={it} />
            </li>
          ))}
        </ul>
      )
    case 'table':
      return (
        <figure key={i} className="my-6 overflow-x-auto">
          <table className="data-table small">
            <thead>
              <tr>
                {b.head.map((h, k) => (
                  <th key={k}>
                    <RichText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {b.caption && (
            <figcaption className="text-sm text-text-muted leading-relaxed">
              <RichText text={b.caption} />
            </figcaption>
          )}
        </figure>
      )
    case 'callout':
      return (
        <Callout key={i} type={b.kind} label={b.title}>
          <RichText text={b.x} />
        </Callout>
      )
    case 'rule':
      return (
        <div
          key={i}
          className="my-6 rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm leading-relaxed text-text-secondary"
        >
          <span className="font-mono text-[10px] tracking-[0.12em] text-primary-light uppercase mr-2">经验</span>
          <RichText text={b.x} />
        </div>
      )
    default:
      return null
  }
}

export default function Chapter() {
  const { slug } = useParams()
  const ch = chapterBySlug(slug)
  const { prev, next } = chapterNeighbors(slug ?? '')

  if (!ch) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <p className="text-text-secondary">这一章不存在，可能是链接拼错了。</p>
        <Link to="/handbook" className="inline-block mt-4 text-primary-light hover:underline">
          回到手册目录
        </Link>
      </div>
    )
  }

  // 目录是纯文本，不能塞 KaTeX：把 $...$ 的定界符去掉，只留公式源码（如 V_o=DV_g），
  // 比显示成对美元符号可读得多，也不用为目录单独维护一份文案。
  const plain = (t: string) => t.replace(/\$([^$]+)\$/g, '$1')
  const headings = ch.blocks
    .map((b, i) => (b.t === 'h' ? { id: `h-${i}`, text: plain(b.x) } : null))
    .filter(Boolean) as { id: string; text: string }[]

  const toc: [string, string][] = [
    ...headings.map((h) => [h.id, h.text] as [string, string]),
    ['pitfalls', '常见误区'],
    ['quiz', '自测'],
    ['sources', '出处'],
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-10">
        <aside className="toc hidden lg:flex">
          <div className="toc-t">本页目录</div>
          {toc.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
          <div className="mt-6 pt-4 border-t border-border text-xs text-text-muted leading-relaxed">
            共 {CHAPTERS.length} 阶
            <br />
            第 {ch.level} 阶 · {ch.band}
          </div>
        </aside>

        <article className="article flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted mb-4">
            <Link to="/handbook" className="text-primary-light hover:underline">
              ← 手册目录
            </Link>
            <span className="font-mono tracking-[0.1em]">第 {ch.level} 阶 · {ch.band}</span>
            <span className="inline-flex items-center gap-1.5">
              难度 <DifficultyDots n={ch.difficulty} />
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 约 {ch.minutes} 分钟
            </span>
          </div>

          <h1>{ch.title}</h1>
          <p className="sub"><RichText text={ch.tagline} /></p>

          {ch.prereq.length > 0 && (
            <p className="text-sm text-text-muted mt-2">
              建议先读：
              {ch.prereq.map((p, i) => {
                const c = chapterBySlug(p)
                return c ? (
                  <span key={p}>
                    {i > 0 && '、'}
                    <Link to={`/handbook/${c.slug}`} className="text-primary-light hover:underline">
                      第 {c.level} 阶 · {c.title}
                    </Link>
                  </span>
                ) : null
              })}
            </p>
          )}

          <div className="my-7 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-primary-light uppercase mb-3">
              <Target className="w-3.5 h-3.5" /> 读完这一章，你能
            </div>
            <ol className="list-decimal pl-5 space-y-1.5 text-sm leading-relaxed text-text-secondary">
              {ch.goal.map((g, i) => (
                <li key={i}>
                  <RichText text={g} />
                </li>
              ))}
            </ol>
          </div>

          {ch.blocks.map(renderBlock)}

          <h2 id="pitfalls">
            <span className="sec">§</span>常见误区
          </h2>
          <ul>
            {ch.pitfalls.map((p, i) => (
              <li key={i}>
                <RichText text={p} />
              </li>
            ))}
          </ul>

          <h2 id="quiz">
            <span className="sec">§</span>自测两题
          </h2>
          <div className="space-y-3">
            {ch.quiz.map((q, i) => (
              <details key={i} className="rounded-lg border border-border bg-surface px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-text-primary">
                  {i + 1}. <RichText text={q.q} />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  <RichText text={q.a} />
                </p>
              </details>
            ))}
          </div>

          <h2 id="sources">
            <span className="sec">§</span>出处
          </h2>
          <div className="rounded-lg border border-border bg-surface px-4 py-4">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase mb-2">
              <BookMarked className="w-3.5 h-3.5" /> 知识库坐标
            </div>
            <ul className="space-y-1.5 text-sm text-text-secondary">
              {ch.sources.map((s, i) => (
                <li key={i}>
                  《{s.book}》{s.where}
                  {typeof s.chunk === 'number' && (
                    <span className="ml-2 font-mono text-[11px] text-text-muted">chunk {s.chunk}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-text-muted leading-relaxed">
              页码与原文段落可通过知识库检索回溯；本页只保证「结论与本条出处对应」，不做逐句翻译。
            </p>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            {prev ? (
              <Link
                to={`/handbook/${prev.slug}`}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 hover:border-primary-light transition-colors"
              >
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  <ArrowLeft className="w-3.5 h-3.5" /> 上一阶
                </span>
                <span className="block mt-1 text-sm font-medium text-text-primary">
                  {prev.level}. {prev.title}
                </span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
            {next ? (
              <Link
                to={`/handbook/${next.slug}`}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-right hover:border-primary-light transition-colors"
              >
                <span className="flex items-center justify-end gap-1.5 text-xs text-text-muted">
                  下一阶 <ArrowRight className="w-3.5 h-3.5" />
                </span>
                <span className="block mt-1 text-sm font-medium text-text-primary">
                  {next.level}. {next.title}
                </span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-secondary leading-relaxed">
            <Lightbulb className="inline w-4 h-4 text-primary-light mr-1.5 -mt-0.5" />
            这一章只给出主干。需要看原文推导、公式出处与覆盖度说明，去读{' '}
            <Link to="/learn/s-to-z" className="text-primary-light hover:underline">
              长篇专题：从 S 变换到 Z 变换
            </Link>
            ，或用{' '}
            <Link to="/tools/tustin" className="text-primary-light hover:underline">
              Tustin 计算器
            </Link>
            把公式当场算一遍。
          </div>
        </article>
      </div>
    </div>
  )
}
