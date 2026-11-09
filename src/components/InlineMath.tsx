import { useEffect, useRef } from 'react'
import katex from 'katex'

/** 行内公式：用于段落、表格单元格等小空间，不添加卡片容器。 */
export default function InlineMath({ latex, className = '' }: { latex: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, { throwOnError: false, displayMode: false })
      } catch {
        ref.current.textContent = latex
      }
    }
  }, [latex])

  return <span ref={ref} className={`inline-math ${className}`} />
}
