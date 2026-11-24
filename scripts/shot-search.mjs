#!/usr/bin/env node
/**
 * 全库检索页截图工具（playwright 真实时间驱动）。
 *
 * 与 audit-search-pw.mjs 同源，只做一件事：把某一状态截成 PNG 留档。
 * 用法：node scripts/shot-search.mjs <baseUrl> <query> <out.png> [width]
 *
 * 为什么不用 chrome --screenshot --virtual-time-budget：
 *   虚拟时钟下 fetch 的 ReadableStream 读到 ~0.1 MB 就停滞，截出来永远是
 *   「正在载入正文索引」那一屏，看起来像功能坏了，其实只是截图工具的问题。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

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
        if (dir.split(path.sep).length - base.split(path.sep).length < 6) stack.push(p)
      }
    }
  }
  return null
}

const pwPath = findPlaywright()
if (!pwPath) {
  console.log('找不到 playwright，无法截图。')
  process.exit(2)
}
const pwMod = await import(pathToFileURL(path.join(pwPath, 'index.js')).href)
// playwright 1.65 的 ESM 入口把 API 挂在 default 上
const chromium = pwMod.chromium || pwMod.default?.chromium
if (!chromium) {
  console.log('playwright 导出里没有 chromium。keys=' + Object.keys(pwMod).join(','))
  process.exit(2)
}

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const base = process.argv[2] || 'http://localhost:4173'
const query = process.argv[3] || ''
const outArg = process.argv[4]
const width = Number(process.argv[5] || 1440)
if (!outArg) {
  console.log('用法：node scripts/shot-search.mjs <baseUrl> <query> <out.png> [width]')
  process.exit(2)
}

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
})
const page = await browser.newPage({ viewport: { width, height: 1200 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

const isFormula = query.startsWith('formula:')
const q = isFormula ? query.slice('formula:'.length) : query
await page.goto(`${base}/search${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
  waitUntil: 'domcontentloaded',
})
if (isFormula) {
  await page.waitForSelector('button:has-text("公式")', { timeout: 20000 })
  await page.click('button:has-text("公式")')
}

// 等到「有结果」或「明确无结果」，两者都算 settled
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

// 给高亮与版式稳定留一拍
await page.waitForTimeout(400)

const out = path.isAbsolute(outArg) ? outArg : path.resolve(process.cwd(), outArg)
fs.mkdirSync(path.dirname(out), { recursive: true })
await page.screenshot({ path: out, fullPage: true })

const info = await page.evaluate(() => {
  const t = document.body.innerText || ''
  return {
    articles: document.querySelectorAll('article').length,
    marks: document.querySelectorAll('mark').length,
    notFound: t.includes('没有命中'),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }
})
await browser.close()

console.log(`settled=${settled} articles=${info.articles} marks=${info.marks} notFound=${info.notFound} 横向溢出=${info.overflow}`)
if (errors.length) console.log('控制台错误：' + JSON.stringify(errors.slice(0, 3)))
console.log('→ ' + out)
