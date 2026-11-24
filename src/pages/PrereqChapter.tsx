import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookMarked, Clock, Target } from 'lucide-react'
import Callout from '../components/Callout'
import MathBlock from '../components/MathBlock'
import MathDemo from '../components/MathDemo'
import RichText from '../components/RichText'
import { PREREQ_CHAPTERS, prereqBySlug, prereqNeighbors } from '../data/prereq'
import { BOOK_TUTORIAL, EXTERNAL_NOTE, TUTORIAL_NOTE } from '../data/prereq/types'
import type { PrereqBlock } from '../data/prereq/types'
import { chapterBySlug } from '../data/handbook'

/**
 * 书内插图。
 *
 * 书里的插图大多只有 100~600 px 宽，直接铺满 860px 的正文栏会糊。
 * 所以：加载完成后按「原始宽度 × 2、上限 1200px」设上限，图片自然居中。
 * 小图（如图5-12 只有 77×82）就保持小尺寸显示——那是书里本来的样子，
 * 放大它等于替作者重画，不如老实呈现。
 */
function BookFigure({ src, caption, credit }: { src: string; caption: string; credit: string }) {
  return (
    <figure className="prereq-figure">
      <img
        src={src}
        alt={caption}
        loading="lazy"
        onLoad={(e) => {
          const el = e.currentTarget
          const nw = el.naturalWidth
          if (nw > 0) el.style.maxWidth = `${Math.min(nw * 2, 1200)}px`
        }}
      />
      <figcaption>
        <span className="prereq-fig-caption">
          <RichText text={caption} />
        </span>
        <span className="prereq-fig-credit">
          <RichText text={credit} />
        </span>
      </figcaption>
    </figure>
  )
}

function renderBlock(b: PrereqBlock, i: number) {
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
          {b.note && (
            <p className="source -mt-2">
              <RichText text={b.note} />
            </p>
          )}
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
    case 'table': {
      // 列数 ≥4 的表在窄屏要横向滚动（见 index.css 的 .tbl-wide/.tbl-mid）。
      // 光能滚还不够：手机浏览器把滚动条藏起来，读者看不出右边还有内容，
      // 会以为表格被截断。所以补一行只在窄屏出现的提示；宽屏表格本来就铺满，不显示。
      const scrollable = b.head.length >= 4
      return (
        <>
          <figure
            key={i}
            className={`my-6 overflow-x-auto ${
              b.head.length >= 5 ? 'tbl-wide' : scrollable ? 'tbl-mid' : ''
            }`}
          >
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
          {scrollable && (
            <p className="-mt-3 mb-4 text-[11px] text-text-muted sm:hidden">← 这张表可以左右滑动看全</p>
          )}
        </>
      )
    }
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
    case 'figure':
      return <BookFigure key={i} src={b.src} caption={b.caption} credit={b.credit} />
    case 'video':
      return (
        <figure key={i} className="prereq-figure">
          <video controls preload="metadata" poster={b.poster} src={b.src} playsInline />
          <figcaption>
            <span className="prereq-fig-caption">
              <RichText text={b.caption} />
            </span>
            <span className="prereq-fig-credit">
              <RichText text={b.credit} />
            </span>
          </figcaption>
        </figure>
      )
    case 'demo':
      return <MathDemo key={i} kind={b.kind} caption={b.caption} />
    default:
      return null
  }
}

export default function PrereqChapter() {
  const { slug } = useParams()
  const ch = prereqBySlug(slug)
  const { prev, next } = prereqNeighbors(slug ?? '')

  if (!ch) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <p className="text-text-secondary">这一章不存在，可能是链接拼错了。</p>
        <Link to="/math" className="inline-block mt-4 text-primary-light hover:underline">
          回到前置知识目录
        </Link>
      </div>
    )
  }

  const plain = (t: string) => t.replace(/\$([^$]+)\$/g, '$1')
  // 本章是否含「外部工程速查稿」这类无书内坐标的出处（目前只有第 7 章）。
  // 有它就不能再说「书内坐标」，也不能只挂 EXTERNAL_NOTE —— 否则等于
  // 把一份没有页码可回溯的稿子，混进「每条结论都能翻书核对」的承诺里。
  const hasTutorialSource = ch.sources.some((s) => s.book === BOOK_TUTORIAL)
  const headings = ch.blocks
    .map((b, i) => (b.t === 'h' ? { id: `h-${i}`, text: plain(b.x) } : null))
    .filter(Boolean) as { id: string; text: string }[]

  const toc: [string, string][] = [
    ...headings.map((h) => [h.id, h.text] as [string, string]),
    ['interface', '与手册的接口'],
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
            共 {PREREQ_CHAPTERS.length} 章
            <br />
            第 {ch.order} 章 · {ch.tool}
          </div>
        </aside>

        <article className="article flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted mb-4">
            <Link to="/math" className="text-primary-light hover:underline">
              ← 前置知识目录
            </Link>
            <span className="font-mono tracking-[0.1em]">第 {ch.order} 章 · {ch.tool}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 约 {ch.minutes} 分钟
            </span>
          </div>

          <h1>{ch.title}</h1>
          <p className="sub">
            <RichText text={ch.tagline} />
          </p>

          {ch.prereq.length > 0 && (
            <p className="text-sm text-text-muted mt-2">
              建议先读：
              {ch.prereq.map((p, i) => {
                const c = prereqBySlug(p)
                return c ? (
                  <span key={p}>
                    {i > 0 && '、'}
                    <Link to={`/math/${c.slug}`} className="text-primary-light hover:underline">
                      第 {c.order} 章 · {c.title}
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

          <h2 id="interface">
            <span className="sec">§</span>与手册的接口
          </h2>
          <div className="space-y-2">
            {ch.links.map((l, i) => {
              const hc = l.slug ? chapterBySlug(l.slug) : undefined
              const to = hc ? `/handbook/${hc.slug}` : l.href
              if (!to) return null
              return (
                <Link
                  key={i}
                  to={to}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:border-primary-light transition-colors"
                >
                  <span className="font-mono text-[11px] text-primary-light whitespace-nowrap pt-0.5">
                    {hc ? `手册 第 ${hc.level} 阶` : '本站专题'}
                  </span>
                  <span className="text-sm text-text-secondary leading-relaxed">
                    <strong className="text-text-primary">
                      {hc ? hc.title : (l.href === '/learn/s-to-z' ? '从 S 变换到 Z 变换' : l.href)}
                    </strong>
                    <br />
                    <RichText text={l.note} />
                  </span>
                </Link>
              )
            })}
          </div>

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
              <BookMarked className="w-3.5 h-3.5" /> {hasTutorialSource ? '出处（含外部速查稿）' : '书内坐标'}
            </div>
            <ul className="space-y-1.5 text-sm text-text-secondary">
              {ch.sources.map((s, i) => (
                <li key={i}>
                  《{s.book}》{s.where}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-text-muted leading-relaxed">{EXTERNAL_NOTE}</p>
            {hasTutorialSource && (
              <p className="mt-2 text-xs text-text-muted leading-relaxed">{TUTORIAL_NOTE}</p>
            )}
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            {prev ? (
              <Link
                to={`/math/${prev.slug}`}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 hover:border-primary-light transition-colors"
              >
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  <ArrowLeft className="w-3.5 h-3.5" /> 上一章
                </span>
                <span className="block mt-1 text-sm font-medium text-text-primary">
                  {prev.order}. {prev.title}
                </span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
            {next ? (
              <Link
                to={`/math/${next.slug}`}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-right hover:border-primary-light transition-colors"
              >
                <span className="flex items-center justify-end gap-1.5 text-xs text-text-muted">
                  下一章 <ArrowRight className="w-3.5 h-3.5" />
                </span>
                <span className="block mt-1 text-sm font-medium text-text-primary">
                  {next.order}. {next.title}
                </span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </article>
      </div>
    </div>
  )
}
