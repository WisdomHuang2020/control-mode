/**
 * 站群 8 色主题契约。
 *
 * 与 main-website-entrance / LLC / AHB / motor-lighting 保持完全一致：
 *   - 键名 pk-theme，?theme= 优先于 localStorage；
 *   - 根元素 data-theme 驱动，index.html 内联脚本负责首屏防闪；
 *   - 默认是深墨 teal，不写 data-theme 时 @theme 里的默认值即生效。
 *
 * 本文件只放 ID / 名称 / 色点；真正的 --color-* 变量在 index.css。
 * 契约对齐点：index.html 内联脚本的 IDS 数组必须与 THEMES 逐项一致。
 */

export const THEME_KEY = 'pk-theme'
export const DEFAULT_THEME = 'dark-teal'
export const THEME_EVENT = 'pk-theme-change'

export const THEMES = [
  { id: 'dark-teal', name: '深墨 teal', dot: '#14b8a6' },
  { id: 'blue', name: '蓝调浅色', dot: '#0070c0' },
  { id: 'navy-tech', name: '深蓝科技', dot: '#3aa0e8' },
  { id: 'graphite', name: '石墨灰', dot: '#3f4855' },
  { id: 'warm-paper', name: '米白手册', dot: '#9a5b13' },
  { id: 'forest', name: '森林墨绿', dot: '#3fbf7f' },
  { id: 'indigo', name: '靛紫柔光', dot: '#5b4bd6' },
  { id: 'sea-salt', name: '海盐青', dot: '#0e7490' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const THEME_BG: Record<ThemeId, string> = {
  'dark-teal': '#0a0a0a',
  blue: '#f6f7f9',
  'navy-tech': '#0b1a2b',
  graphite: '#f2f3f5',
  'warm-paper': '#faf6ed',
  forest: '#0c1712',
  indigo: '#f6f5fc',
  'sea-salt': '#eef7f7',
}

export function isThemeId(v: string | null): v is ThemeId {
  return !!v && THEMES.some((t) => t.id === v)
}

/** 与 index.html 内联脚本同一套读取规则 */
export function readStoredTheme(): ThemeId {
  try {
    const q = new URLSearchParams(location.search).get('theme')
    const stored = localStorage.getItem(THEME_KEY)
    return isThemeId(q) ? q : isThemeId(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id
  try {
    localStorage.setItem(THEME_KEY, id)
  } catch {
    /* 隐私模式下 localStorage 会抛错，忽略即可 */
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_BG[id])
  // 顶栏与移动端菜单各挂一个切换器，靠事件保持两处显示同步
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: id }))
}

/**
 * 供 canvas / 内联样式使用的实际色值。
 * canvas 不认 `var(--color-*)`，必须先解析成具体色值，切换主题后重新读取。
 */
export function readThemeColors() {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    grid: v('--color-border', '#404040'),
    frame: v('--color-border-light', '#525252'),
    muted: v('--color-text-muted', '#a3a3a3'),
    accent: v('--color-accent', '#f59e0b'),
    accentLight: v('--color-accent-light', '#fbbf24'),
    primaryLight: v('--color-primary-light', '#14b8a6'),
  }
}

export type ThemeColors = ReturnType<typeof readThemeColors>

