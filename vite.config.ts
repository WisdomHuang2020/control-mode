import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'))

export default defineConfig({
  // 正式通道（自有域名，BrowserRouter）用根绝对 base '/'：深链接刷新时 assets 才不会
  // 被解析到 /learn/assets/ 这种不存在的路径。
  // GitHub Pages 兜底通道由 deploy.yml 以 `vite build --base /control-mode/` 单独构建，
  // 不复用这份 dist。两条通道各自构建，避免「一份产物服务两种路径」的相对路径陷阱。
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.join(root, 'src') },
  },
  // 版本号单一来源：package.json → 构建期常量 → 页头/页脚徽标。
  // 任何页面都不得出现 vX.Y.Z 字面量，由 scripts/assert-version.mjs 断言。
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
