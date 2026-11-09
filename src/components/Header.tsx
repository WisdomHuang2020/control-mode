import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, House, BookOpen, Calculator, Layers } from 'lucide-react'
import BrandMark from './BrandMark'
import VersionBadge from './VersionBadge'
import ThemeSwitcher from './ThemeSwitcher'

const navLinks = [
  { path: '/', label: '首页', icon: Layers },
  { path: '/learn/s-to-z', label: '培训', icon: BookOpen },
  { path: '/tools/tustin', label: '工具', icon: Calculator },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 text-text-primary hover:text-primary-light transition-colors shrink-0">
          <BrandMark className="w-6 h-6" />
          <span className="font-bold text-lg tracking-tight">建模与控制<span className="text-primary-light">.</span>知识工程</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path
            const Icon = link.icon
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'text-primary-light bg-primary-dark/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <VersionBadge />
          <a
            href="https://power-knowledge.tech/"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-light transition-colors"
          >
            <House className="w-4 h-4" /> 站群入口
          </a>
          <ThemeSwitcher />
        </div>

        <button
          className="md:hidden p-2 text-text-secondary hover:text-text-primary"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="切换导航"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-surface border-b border-border px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
              >
                <Icon className="w-5 h-5" /> {link.label}
              </Link>
            )
          })}
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <VersionBadge />
            <ThemeSwitcher />
          </div>
        </div>
      )}
    </header>
  )
}
