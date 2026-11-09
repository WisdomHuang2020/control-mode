import type { ReactNode } from 'react'
import InlineMath from './InlineMath'

/**
 * 手册正文的极轻量标记渲染器。
 * 支持两种标记，够用且不需要引入 MDX：
 *   $...$   → 行内 KaTeX
 *   **...** → 加粗
 *
 * 注意嵌套顺序：**先切加粗、再切公式**。
 * 反过来会出错——像「**$T(s)$ 幅值降到 0dB…**」这种「加粗里包公式」的写法，
 * 若先切公式，两个 ** 会被分到不同片段里，永远配不成对，页面上就会露出星号。
 */

function mathNodes(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\$([^$]+)\$/g
  let last = 0
  let i = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={`${keyBase}-t${i}`}>{text.slice(last, m.index)}</span>)
    out.push(<InlineMath key={`${keyBase}-m${i}`} latex={m[1]} />)
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) out.push(<span key={`${keyBase}-t${i}`}>{text.slice(last)}</span>)
  return out
}

export default function RichText({ text }: { text: string }) {
  const out: ReactNode[] = []
  const parts = text.split(/\*\*(.+?)\*\*/g)

  parts.forEach((part, i) => {
    if (!part) return
    const nodes = mathNodes(part, `p${i}`)
    // split 后奇数下标就是 ** ** 包裹的内容
    out.push(i % 2 === 1 ? <strong key={`b${i}`}>{nodes}</strong> : <span key={`s${i}`}>{nodes}</span>)
  })

  return <>{out}</>
}
