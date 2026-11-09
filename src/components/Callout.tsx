import type { ReactNode } from 'react'

type CalloutType = 'key' | 'note' | 'ok' | 'warn'

const LABELS: Record<CalloutType, string> = {
  key: '结论',
  note: '记住',
  ok: '动手',
  warn: '注意',
}

export default function Callout({
  type = 'note',
  label,
  children,
  id,
}: {
  type?: CalloutType
  label?: string
  children: ReactNode
  id?: string
}) {
  return (
    <div className={`callout ${type}`} id={id}>
      <span className="lbl">{label ?? LABELS[type]}</span>
      <div>{children}</div>
    </div>
  )
}
