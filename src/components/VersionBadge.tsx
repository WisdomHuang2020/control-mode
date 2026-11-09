/**
 * 版本号单一来源的显示点。
 *
 * 版本来自 vite.config.ts 的 define(__APP_VERSION__)，源头是 package.json。
 * 用 class 钩子而非 id：页头与页脚各一处，新增显示点时复制本组件即可，
 * scripts/assert-version.mjs 会断言「显示点数 == 常量引用数」。
 * define 未生效时显示 dev，不伪造一个看起来正常的版本号。
 */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

export default function VersionBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`app-version font-mono text-xs text-text-muted border border-border rounded-full px-2 py-0.5 tracking-wide ${className}`}
      title="构建版本号（源：package.json）"
    >
      v{APP_VERSION}
    </span>
  )
}
