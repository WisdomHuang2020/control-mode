#!/usr/bin/env node
// 生成 __probe.html（index.html 的副本，注入探针脚本），并对给定路由跑一轮无头 Chrome 审计。
//
// 用法：node scripts/audit-prereq-dom.mjs <baseUrl> <route1> <route2> ...
// 前置：先 npm run build，再起本地服务（npx vite preview --port 4173）。
//
// 探针的两个关键点（都是上一轮审核踩出来的坑）：
//   ① 出处/接口列表挂在 <h2 id="sources"> 的**兄弟节点**里，
//      querySelector('#sources li') 恒为空 —— 看起来「18/18 有出处」，其实一条没验到。
//   ② 画布整块铺了不透明底色，用「alpha>20 的像素数」当判据会得到 coverage=1，
//      什么也证明不了。必须先找主色（背景），再统计与主色不同的像素。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(here, '..', 'dist')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const base = process.argv[2] || 'http://localhost:4173'
const routes = process.argv.slice(3)

// 1) 注入探针（vite build 会清空 dist，所以每次 build 后都要重新拷进去）
fs.mkdirSync(path.join(DIST, '__probe_src'), { recursive: true })
fs.copyFileSync(path.join(here, 'probe-prereq.js'), path.join(DIST, '__probe_src', 'probe_inject.js'))
const idx = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
fs.writeFileSync(
  path.join(DIST, '__probe.html'),
  idx.replace('</body>', '<script src="/__probe_src/probe_inject.js"></script>\n</body>')
)

const rows = []
for (const route of routes) {
  const ud = `C:/Users/xuexi/AppData/Local/Temp/ck_prq_${Math.floor(Math.random() * 1e6)}`
  let dom = ''
  try {
    dom = execFileSync(
      CHROME,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=1440,2200',
        `--user-data-dir=${ud}`,
        '--virtual-time-budget=14000',
        '--dump-dom',
        `${base}/__probe.html?target=${encodeURIComponent(route)}`,
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
    )
  } catch (e) {
    console.log(`\n### ${route}\nCHROME FAILED: ${e.message}`)
    continue
  }
  const m = dom.match(/<pre id="__probe">([\s\S]*?)<\/pre>/)
  if (!m) {
    console.log(`\n### ${route}\nNO PROBE OUTPUT (dom ${dom.length} bytes)`)
    rows.push({ route, fail: 'no-probe' })
    continue
  }
  const raw = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    console.log(`\n### ${route}\nPROBE JSON PARSE FAIL: ${e.message}\n${raw.slice(0, 600)}`)
    rows.push({ route, fail: 'bad-json' })
    continue
  }
  rows.push({ route, parsed })
  console.log(`\n########## ${route}`)
  for (const s of parsed) {
    const v = JSON.stringify(s.ok ? s.r : s.err)
    console.log(`${s.ok ? 'OK  ' : 'FAIL'} ${s.name.padEnd(20)} ${v.slice(0, 900)}`)
  }
}

fs.writeFileSync(path.join(here, '..', '.audit-prereq.json'), JSON.stringify(rows, null, 1))
console.log('\n→ .audit-prereq.json')
