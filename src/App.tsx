import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Handbook from './pages/Handbook'
import Chapter from './pages/Chapter'
import SToZ from './pages/SToZ'
import Tustin from './pages/Tustin'

// 路由模式按托管环境选择，与站群其余 React 站同一套逻辑：
//  • 自有域名由 nginx 提供 SPA 回退 ⇒ BrowserRouter，URL 干净。
//  • GitHub Pages 子路径托管且无服务端回退 ⇒ HashRouter，深链接刷新不 404。
const isGitHubPages =
  typeof window !== 'undefined' && /\.github\.io$/i.test(window.location.hostname)

if (!isGitHubPages && typeof window !== 'undefined' && window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1))
}

const Router = isGitHubPages ? HashRouter : BrowserRouter

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/handbook" element={<Handbook />} />
          <Route path="/handbook/:slug" element={<Chapter />} />
          <Route path="/learn/s-to-z" element={<SToZ />} />
          <Route path="/tools/tustin" element={<Tustin />} />
          {/* 未知路径回首页：SPA 由 nginx 回退，这里给出确定行为，不显示空白页。 */}
          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
    </Router>
  )
}
