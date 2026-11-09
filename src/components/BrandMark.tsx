/**
 * 本站品牌标记 —— 与 public/favicon.svg 同源。
 *
 * 语义：s 平面左半平面 → z 平面单位圆的映射（本站培训页 §2 的主图）。
 * 造型沿用站群统一规范：32×32 圆角深底、teal 主形、amber 点落在关键位置。
 * LLC 的 BrandMark 是「谐振尖峰脉冲」，这里是「阶跃 → 单位圆」，形状不同但色板一致。
 */
export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0a0a0a" />
      <circle cx="21" cy="16" r="8" fill="none" stroke="#14b8a6" strokeWidth={1.8} />
      <path d="M3 24 H10 V9 H27" fill="none" stroke="#14b8a6" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21" cy="16" r="2.3" fill="#f59e0b" />
    </svg>
  )
}
