import { useEffect, useRef } from 'react'
import katex from 'katex'

interface MathBlockProps {
  latex: string
  display?: boolean
  important?: boolean
  label?: string
}

/** 自动剥离 $$...$$ / \[...\] / \(...\) 等常见定界符，便于直接粘贴原文公式。 */
function stripDelimiters(raw: string): string {
  const s = raw.trim()
  const pairs: [string, string][] = [
    ['$$', '$$'], ['\\[', '\\]'], ['\\(', '\\)'],
    ['\\begin{equation}', '\\end{equation}'],
    ['\\begin{align}', '\\end{align}'],
  ]
  for (const [open, close] of pairs) {
    if (s.startsWith(open) && s.endsWith(close)) {
      return s.slice(open.length, -close.length).trim()
    }
  }
  if (s.startsWith('$') && s.endsWith('$') && !s.startsWith('$$')) {
    return s.slice(1, -1).trim()
  }
  return s
}

export default function MathBlock({ latex, display = true, important = false, label }: MathBlockProps) {
  const ref = useRef<HTMLDivElement>(null)
  const clean = stripDelimiters(latex)

  useEffect(() => {
    if (ref.current) {
      katex.render(clean, ref.current, { throwOnError: false, displayMode: display })
    }
  }, [clean, display])

  return (
    <div className={`math-block ${important ? 'important' : ''} my-4`}>
      <div className="math-block-label">
        <span className="math-block-label-left">
          {label && <span className="label-text">{label}</span>}
        </span>
        <span className="math-block-number" />
      </div>
      <div ref={ref} />
    </div>
  )
}
