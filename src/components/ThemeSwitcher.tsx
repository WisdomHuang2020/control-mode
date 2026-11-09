import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  DEFAULT_THEME, THEMES, THEME_EVENT, applyTheme, isThemeId, readStoredTheme, type ThemeId,
} from '../theme'

/**
 * 站群通用 8 色风格切换器。
 * 视觉与 LLC / AHB 顶栏的「● 风格 ▾」一致：色点 + 文字 + 箭头，菜单右对齐。
 */
export default function ThemeSwitcher({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = readStoredTheme()
    setTheme(id)
    document.documentElement.dataset.theme = id
  }, [])

  // 同一页面可能有两个实例（顶栏 + 移动菜单），互相同步
  useEffect(() => {
    const onSync = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (isThemeId(id)) setTheme(id)
    }
    window.addEventListener(THEME_EVENT, onSync)
    return () => window.removeEventListener(THEME_EVENT, onSync)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  return (
    <div className={`relative ${className}`} ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="切换页面配色风格"
        title="切换页面配色风格"
        className="flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-sm text-text-secondary transition-colors hover:border-border hover:text-text-primary"
      >
        <span
          className="h-2.5 w-2.5 flex-none rounded-full ring-1 ring-black/25"
          style={{ backgroundColor: current.dot }}
        />
        <span>风格</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-surface-elevated p-1.5 shadow-2xl"
        >
          <div className="px-2.5 pb-2 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            页面风格 · 站群通用 8 套
          </div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === theme}
              onClick={() => {
                setTheme(t.id)
                applyTheme(t.id)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-primary-light/10 ${
                t.id === theme ? 'font-semibold text-primary-light' : 'text-text-secondary'
              }`}
            >
              <span
                className="h-2.5 w-2.5 flex-none rounded-full ring-1 ring-black/25"
                style={{ backgroundColor: t.dot }}
              />
              <span className="flex-1">{t.name}</span>
              {t.id === theme && <Check className="h-3.5 w-3.5 flex-none" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
