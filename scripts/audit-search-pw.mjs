#!/usr/bin/env node
/**
 * 全库检索页的真实浏览器审计（playwright 驱动）。
 *
 * 为什么不用 --headless=new --dump-dom + --virtual-time-budget：
 *   实测在虚拟时钟下，fetch 的 ReadableStream 读到约 0.1 MB 就不再推进，
 *   页面永远停在「正在载入正文索引（已接收 0.1 MB）」，探针拿到的全是 0。
 *   那是 headless 虚拟时钟与流式读取的交互问题，不是产品代码的问题——
 *   但它足以让审计得出错误结论，所以这里改用真实时间的 playwright。
 *
 * 依赖：全局 @playwright/cli 自带的 playwright（1.65.x），不往项目里加依赖。
 * 用法：node scripts/audit-search-pw.mjs http://localhost:4173 右半平面零点 ZVS
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// playwright 在全局 @playwright/cli 的 node_modules 里，不在项目依赖内。
// 版本目录随 node 版本变化，所以用 glob 找而不是写死路径。
function findPlaywright() {
  const bases = [
    path.join(os.homedir(), '.workbuddy', 'binaries', 'node', 'versions'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules'),
    path.join(process.env.LOCALAPPDATA || '', 'npm-cache'),
  ]
  for (const base of bases) {
    if (!fs.existsSync(base)) continue
    const stack = [base]
    while (stack.length) {
      const dir = stack.pop()
      let entries
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const e of entries) {
        if (!e.isDirectory()) continue
        const p = path.join(dir, e.name)
        if (e.name === 'playwright' && fs.existsSync(path.join(p, 'index.js'))) return p
        // 只往下钻有限几层，避免扫全盘
        if (dir.split(path.sep).length - base.split(path.sep).length < 6) stack.push(p)
      }
    }
  }
  return null
}

const pwPath = findPlaywright()
if (!pwPath) {
  console.log('找不到 playwright（全局 @playwright/cli 缺失），跳过浏览器审计。')
  process.exit(2)
}
const pwMod = await import(pathToFileURL(path.join(pwPath, 'index.js')).href)
// playwright 1.65 的 ESM 入口把 API 挂在 default 上，具名导出里没有 chromium
const chromium = pwMod.chromium || pwMod.default?.chromium
if (!chromium) {
  console.log('playwright 导出里没有 chromium，跳过。keys=' + Object.keys(pwMod).join(','))
  process.exit(2)
}

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const base = process.argv[2] || 'http://localhost:4173'
const queries = process.argv.slice(3)
if (!queries.length) {
  console.log('用法：node scripts/audit-search-pw.mjs <baseUrl> <query...>')
  process.exit(2)
}

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
})

const rows = []
for (const raw of queries) {
  // 以 formula: 开头的查询会先切到「公式」页签再等结果
  const isFormula = raw.startsWith('formula:')
  const q = isFormula ? raw.slice('formula:'.length) : raw

  const page = await browser.newPage({ viewport: { width: 1440, height: 2400 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  const t0 = Date.now()
  await page.goto(`${base}/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' })

  if (isFormula) {
    await page.waitForSelector('button:has-text("公式")', { timeout: 20000 })
    await page.click('button:has-text("公式")')
  }

  // 等检索真正跑完：结果区出现 <article>，或出现「没有命中」
  let settled = 'timeout'
  try {
    await page.waitForFunction(
      () => {
        const t = document.body.innerText || ''
        return document.querySelectorAll('article').length > 0 || t.includes('没有命中')
      },
      { timeout: 90000, polling: 250 }
    )
    settled = 'ok'
  } catch {
    settled = 'timeout'
  }
  const elapsed = Date.now() - t0

  const data = await page.evaluate(() => {
    const t = document.body.innerText || ''
    const num = (re) => (t.match(re) || [])[1] || null
    const marks = document.querySelectorAll('mark')
    return {
      h1: (document.querySelector('h1') || {}).textContent || null,
      articles: document.querySelectorAll('article').length,
      marks: marks.length,
      markSamples: [...marks].slice(0, 6).map((m) => m.textContent),
      notFound: t.includes('没有命中'),
      terms: num(/切出\s*(\d+)\s*个检索词/),
      termList: [...document.querySelectorAll('code')]
        .map((c) => c.textContent)
        .filter((s) => s && s.length < 20)
        .slice(0, 8),
      ms: num(/检索词[\s\S]{0,120}?([\d.]+)\s*ms/) || num(/([\d.]+)\s*ms/),
      hitsReported: num(/命中\s*(\d+)\s*(?:段|条)/),
      missingTerm: (t.match(/「([^」]+)」未命中/) || [])[1] || null,
      /** 空结果时的完整提示文案——要能区分「从未出现」与「出现过但没共现」两类 */
      emptyText: t.includes('没有命中')
        ? t.slice(t.indexOf('没有命中'), t.indexOf('没有命中') + 260).replace(/\s+/g, ' ')
        : null,
      honestNote: t.includes('这是字面检索，不是语义问答'),
      loading: t.includes('正在载入') || t.includes('正在建立内存索引'),
      overflowX: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      firstSnippet: (document.querySelector('article p') || {}).textContent || null,
    }
  })

  await page.close()
  rows.push({ q, isFormula, settled, elapsedMs: elapsed, errors, ...data })

  console.log(`\n########## ${isFormula ? '[公式] ' : ''}${q}`)
  console.log(`  settled          ${settled}  (${elapsed} ms)`)
  for (const [k, v] of Object.entries(data)) {
    console.log(`  ${k.padEnd(16)} ${JSON.stringify(v)}`)
  }
  if (errors.length) console.log(`  errors           ${JSON.stringify(errors.slice(0, 3))}`)
}

await browser.close()
fs.writeFileSync(path.join(here, '..', '.audit-search.json'), JSON.stringify(rows, null, 1))
console.log('\n→ .audit-search.json')
