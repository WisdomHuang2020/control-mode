import { Link } from 'react-router-dom'
import { Github, BookOpen, Calculator, House } from 'lucide-react'
import BrandMark from './BrandMark'
import VersionBadge from './VersionBadge'

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-border mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BrandMark className="w-5 h-5" />
              <span className="font-bold text-text-primary">建模与控制 · 知识工程</span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              从 43 本开关变换器与自动控制专著出发，把书里的公式变成可溯源的培训页与可复核的计算工具。
            </p>
            <a
              href="https://power-knowledge.tech/"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-primary-light/50 hover:text-primary-light"
            >
              <House className="h-4 w-4" /> 返回站群入口
            </a>
          </div>
          <div>
            <h4 className="font-semibold text-text-primary mb-4 text-sm uppercase tracking-wider">口径与免责</h4>
            <p className="text-text-secondary text-sm leading-relaxed">
              本站为个人非商业性技术分享。计算方法与公式均来自公开教材，仅用于教学与工程估算，
              不构成设计保证，不替代厂商数据手册、实测波形与第三方仿真复核。
            </p>
            <p className="text-text-secondary text-sm leading-relaxed mt-2">
              培训页中的公式与推导注明出处；工具页结果为理想模型计算值。
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-text-primary mb-4 text-sm uppercase tracking-wider">站内导航</h4>
            <div className="space-y-2">
              <Link to="/learn/s-to-z" className="flex items-center gap-2 text-text-secondary hover:text-primary-light text-sm transition-colors">
                <BookOpen className="w-4 h-4" /> 从 S 变换到 Z 变换
              </Link>
              <Link to="/tools/tustin" className="flex items-center gap-2 text-text-secondary hover:text-primary-light text-sm transition-colors">
                <Calculator className="w-4 h-4" /> Tustin / 预畸变计算器
              </Link>
            </div>
            <h4 className="font-semibold text-text-primary mt-6 mb-3 text-sm uppercase tracking-wider">版权</h4>
            <p className="text-text-muted text-xs leading-relaxed">
              站内引用的书籍内容仅作教学评论与说明，版权归原作者与出版方所有，本站不提供书籍全文下载。
            </p>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="text-text-muted text-sm">© 2026 建模与控制知识工程</p>
            {/* 备案信息：工信部与公安联网备案均要求网站底部公开展示，与站群其余站同一套。
                图标 URL 拼 BASE_URL：正式域名为 '/beian.png'，Pages 子路径为
                '/control-mode/beian.png'。写成固定 './beian.png' 会在 SPA 深链接刷新时
                被浏览器解析到 /learn/beian.png 而 404。 */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1">
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-secondary text-sm">
                苏ICP备2026073104号-1
              </a>
              <a href="https://beian.mps.gov.cn/#/query/webSearch?code=32021402005238" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-text-muted hover:text-text-secondary text-sm">
                <img src={`${import.meta.env.BASE_URL}beian.png`} alt="" className="h-4 w-auto" />
                苏公网安备32021402005238号
              </a>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <VersionBadge />
            <a href="https://github.com/WisdomHuang2020/control-mode" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-text-muted hover:text-text-secondary text-sm transition-colors">
              <Github className="w-4 h-4" /> GitHub
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-text-muted text-xs leading-relaxed">
            <span className="font-medium text-text-secondary">免责声明：</span>
            本站为个人非商业性技术分享。全部计算结果基于公开理论模型与解析近似，仅供工程估算与学习研究参考，
            不构成设计保证，亦不替代器件数据手册、实测波形、仿真与第三方专业复核。任何主体引用本站内容或据此作出的工程决策，
            风险与责任由该主体自行承担。
          </p>
          <p className="mt-2 text-text-muted text-xs leading-relaxed">
            站内图表、公式推导与文字内容为作者原创或基于公开资料整理；文中提及的软件、标准、商标与厂商名称，
            权利均归各自权利人所有，仅作技术说明引用。
          </p>
        </div>
      </div>
    </footer>
  )
}
