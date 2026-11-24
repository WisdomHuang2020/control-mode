import { useMemo } from 'react'
import {
  localRanges,
  overlapsAny,
  renderMathToHtml,
  splitMathAware,
  stripMathDelimiters,
} from '../lib/mathText'

/**
 * 带公式渲染的片段。
 *
 * 与手册正文用的 RichText 不同：这里还必须同时画出**命中高亮**。
 * 难点在于高亮的区间是相对**原始片段**的字符偏移，而片段被切成
 * 「正文 / 公式」多段后偏移就变了，所以每段都要把自己的局部区间算出来（localRanges）。
 * 公式段内部没法塞 <mark>（KaTeX 的 DOM 我们不碰），改为给整条公式加底色（math-hit）。
 */

/** 正文段：在局部坐标上画 <mark>。 */
function Prose({
  text,
  base,
  ranges,
}: {
  text: string
  base: number
  ranges: Array<[number, number]>
}) {
  const local = useMemo(() => localRanges(base, text.length, ranges), [base, text.length, ranges])
  if (!local.length) return <>{text}</>

  const nodes: React.ReactNode[] = []
  let cur = 0
  local.forEach(([s, e], i) => {
    if (s > cur) nodes.push(text.slice(cur, s))
    nodes.push(
      <mark key={i} className="bg-primary/25 text-text-primary rounded-sm px-0.5">
        {text.slice(s, e)}
      </mark>
    )
    cur = e
  })
  if (cur < text.length) nodes.push(text.slice(cur))
  return <>{nodes}</>
}

/** 公式段：能渲染就渲染，渲染不了如实露出原文。 */
function MathPiece({
  latex,
  open,
  close,
  hit,
}: {
  latex: string
  open: string
  close: string
  hit: boolean
}) {
  const rendered = useMemo(() => renderMathToHtml(latex), [latex])

  if (!rendered) {
    // 渲染失败不是异常，是**如实**：
    // 这段数据里 OCR 缺反斜杠很常见（`\omegan`、`\ce`、`\frac{1}{D&#x27;}`），
    // 硬塞给 KaTeX 只会得到红字或错版。原样露出来，读者才知道这行原文是残的。
    return (
      <code className={`snippet-raw-math${hit ? ' math-hit' : ''}`}>
        {open}
        {latex}
        {close}
      </code>
    )
  }

  return (
    <span
      className={`snippet-math${rendered.display ? ' is-display' : ''}${hit ? ' math-hit' : ''}`}
      // 这里的 HTML 由 KaTeX 从**本站自有语料**生成，且 trust:false 已禁用
      // \href / \url / \htmlClass 这类可注入属性的命令；正文内容由 KaTeX 自行转义。
      // 与正文不同，正文一律走 React 节点拼接，不碰 innerHTML。
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  )
}

export default function MathText({
  text,
  ranges = [],
}: {
  text: string
  ranges?: Array<[number, number]>
}) {
  const segs = useMemo(() => splitMathAware(text), [text])

  return (
    <>
      {segs.map((g) =>
        g.latex === null ? (
          <Prose key={g.s} text={text.slice(g.s, g.e)} base={g.s} ranges={ranges} />
        ) : (
          <MathPiece
            key={g.s}
            latex={g.latex}
            open={g.open || '$'}
            close={g.close || '$'}
            hit={overlapsAny(g.s, g.e, ranges)}
          />
        )
      )}
    </>
  )
}

/**
 * 块级公式（公式页签用）。
 * 渲染不了同样退回原样 `<pre>`，与改造前的行为一致，不算退步。
 */
export function DisplayMath({ latex }: { latex: string }) {
  const rendered = useMemo(() => renderMathToHtml(latex, true), [latex])
  const source = useMemo(() => stripMathDelimiters(latex), [latex])

  if (!rendered) {
    return (
      <pre className="overflow-x-auto text-xs font-mono text-text-secondary bg-surface-elevated rounded p-2.5">
        {latex}
      </pre>
    )
  }

  return (
    <div className="snippet-display-math">
      <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: rendered.html }} />
      <details className="mt-1.5 group">
        <summary className="text-[11px] text-text-muted cursor-pointer select-none hover:text-text-secondary">
          LaTeX 原文
        </summary>
        <pre className="mt-1 overflow-x-auto text-[11px] font-mono text-text-muted bg-surface-elevated rounded p-2">
          {source}
        </pre>
      </details>
    </div>
  )
}
