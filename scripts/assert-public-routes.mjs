#!/usr/bin/env node
/**
 * 断言：public/ 下的一级目录名，不得与任何路由路径的第一段重名。
 *
 * 为什么要有这条门禁（v1.7.0 的真实事故）：
 *   索引当时放在 public/search/，构建后是 dist/search/，而路由也叫 /search。
 *   nginx 的 `try_files $uri $uri/ /index.html` 会先命中真实目录：
 *       GET /search   → 301 /search/     （同名目录存在）
 *       GET /search/  → 403 Forbidden    （目录没有 index.html）
 *   结果首页卡片点进去是 403，而 /search/index-*.json 却正常 200。
 *
 *   本地 `vite preview` **不会**暴露这个问题——它没有 try_files 逻辑，
 *   /search 直接回 SPA 的 index.html，看起来完全正常。只有上线才看得到。
 *
 * 所以把「目录名 vs 路由段」的冲突钉成构建前就能发现的硬断言。
 *
 * 用法：node scripts/assert-public-routes.mjs
 * 退出码 0 = 无冲突；非 0 = 有冲突，列出了哪几个。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')

// ── 路由第一段 ───────────────────────────────────────────
const appSrc = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8')
const routePaths = [...appSrc.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
const routeSegments = new Set()
for (const p of routePaths) {
  if (p === '*' || p === '/') continue
  const first = p.split('/').filter(Boolean)[0]
  if (first && !first.startsWith(':')) routeSegments.add(first)
}

// ── public 一级目录 ──────────────────────────────────────
const publicDir = path.join(root, 'public')
const publicDirs = fs.existsSync(publicDir)
  ? fs
      .readdirSync(publicDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : []

const conflicts = publicDirs.filter((d) => routeSegments.has(d))

console.log('public 目录 vs 路由段')
console.log(`  路由段    ${[...routeSegments].sort().join(', ') || '（无）'}`)
console.log(`  public/   ${publicDirs.sort().join(', ') || '（无）'}`)

if (conflicts.length) {
  for (const c of conflicts) {
    console.log(
      `  ✘ public/${c}/ 与路由 /${c} 同名：nginx 会把这个路径当真实目录 301 到 /${c}/，目录缺 index 时直接 403。`
    )
  }
  console.log('结论：必须给静态目录改名（例如加 -data 后缀）。本地 vite preview 不会暴露这个问题。')
  process.exit(1)
}

console.log(`结论：✔ 无冲突（检查 ${publicDirs.length} 个目录 / ${routeSegments.size} 个路由段）`)
