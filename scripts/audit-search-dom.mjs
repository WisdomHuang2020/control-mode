#!/usr/bin/env node
/**
 * 全库检索页的无头 DOM 审计。
 *
 * 用法：node scripts/audit-search-dom.mjs <baseUrl> <query1> <query2> ...
 * 前置：npm run build && npx vite preview --port 4173
 *
 * 它要证伪的是三类「看起来正常、其实没工作」：
 *   ① 索引没下发 —— 页面一直停在「正在载入」，但截图看不出异常；
 *   ② 结果是有的，但 <mark> 标到了别的地方（区间算错，纯文本内容正确）；
 *   ③ 页面把「没有命中」和「加载失败」显示成同一种样子。
 *
 * 探针按 target 参数在 SPA 内跳路由（不走整页刷新，否则会丢掉已加载的索引）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(here, '..', 'dist')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const base = process.argv[2] || 'http://localhost:4173'
const queries = process.argv.slice(3)

// 注入探针（vite build 会清空 dist，每次 build 后都要重新拷）
fs.mkdirSync(path.join(DIST, '__probe_src'), { recursive: true })
fs.copyFileSync(path.join(here, 'probe-search.js'), path.join(DIST, '__probe_src', 'probe_search.js'))
const idx = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
fs.writeFileSync(
  path.join(DIST, '__probe_search.html'),
  idx.replace('</body>', '<script src="/__probe_src/probe_search.js"></script>\n</body>')
)

const rows = []
for (const q of queries) {
  const route = `/search?q=${encodeURIComponent(q)}`
  const ud = `C:/Users/xuexi/AppData/Local/Temp/ck_srch_${Math.floor(Math.random() * 1e6)}`
  let dom = ''
  try {
    dom = execFileSync(
      CHROME,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=1440,2400',
        `--user-data-dir=${ud}`,
        // 索引 6.85 MB（生产 gzip）/ 23 MB（本地未压缩）+ parse + 250 ms 防抖
        '--virtual-time-budget=120000',
        '--dump-dom',
        `${base}/__probe_search.html?target=${encodeURIComponent(route)}`,
      ],
      { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
    )
  } catch (e) {
    console.log(`\n### ${q}\nCHROME FAILED: ${e.message}`)
    rows.push({ q, fail: 'chrome' })
    continue
  }

  const m = dom.match(/<pre id="__probe">([\s\S]*?)<\/pre>/)
  if (!m) {
    console.log(`\n### ${q}\nNO PROBE OUTPUT（dom ${dom.length} bytes）`)
    rows.push({ q, fail: 'no-probe' })
    continue
  }
  const raw = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
  let r
  try {
    r = JSON.parse(raw)
  } catch (e) {
    console.log(`\n### ${q}\nPROBE JSON FAIL: ${e.message}\n${raw.slice(0, 400)}`)
    rows.push({ q, fail: 'bad-json' })
    continue
  }
  rows.push({ q, ...r })

  console.log(`\n########## ${q}`)
  const show = (k, v) => console.log(`  ${k.padEnd(16)} ${JSON.stringify(v)}`)
  show('ready', r.ready)
  show('articles', r.articles)
  show('marks', r.marks)
  show('markSamples', r.markSamples)
  show('notFound', r.notFound)
  show('terms', r.terms)
  show('ms', r.ms)
  show('hitsReported', r.hitsReported)
  show('missingTerm', r.missingTerm)
  show('honestNote', r.honestNote)
  show('navHasSearch', r.navHasSearch)
  show('stageText', r.stageText)
  show('tickCount', r.tickCount)
  show('overflowX', r.overflowX)
}

fs.writeFileSync(path.join(here, '..', '.audit-search.json'), JSON.stringify(rows, null, 1))
console.log('\n→ .audit-search.json')
