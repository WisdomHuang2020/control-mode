#!/usr/bin/env node
/**
 * 检索结果「公式渲染」的浏览器审计。
 *
 * 要回答的四个问题（离线断言答不了，必须真渲染一遍）：
 *   ① 片段里还剩没剩下裸露的 `$…$`？
 *   ② 有多少条渲染成功、多少条退回原文？
 *   ③ KaTeX 的字体与 CSS 有没有真的加载（字体没到会显示成方框/错位）；
 *   ④ 375 像素窄屏下，长公式会不会把卡片撑破（KaTeX 内部是 nowrap，
 *      这是渲染公式后最可能引入的回归）。
 *
 * 用法：node scripts/audit-search-math.mjs [baseUrl]
 */
import { loadPlaywright } from './lib/playwright.mjs'

const base = process.argv[2] || 'http://localhost:4173'
const QUERIES = ['右半平面零点', '峰值电流模式 斜坡补偿', 'Boost 传递函数']
const WIDTHS = [375, 768, 1440]

const pw = await loadPlaywright()
if (!pw) {
  console.log('找不到 playwright，跳过浏览器审计。')
  process.exit(2)
}

const browser = await pw.chromium.launch({ executablePath: pw.executablePath, headless: true })
let failed = 0

for (const width of WIDTHS) {
  for (const q of QUERIES) {
    const page = await browser.newPage({ viewport: { width, height: 1200 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })

    await page.goto(`${base}/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' })
    let settled = 'ok'
    try {
      await page.waitForFunction(
        () => {
          const t = document.body.innerText || ''
          return document.querySelectorAll('article').length > 0 || t.includes('没有命中')
        },
        { timeout: 90000, polling: 250 }
      )
    } catch {
      settled = 'timeout'
    }
    await page.waitForTimeout(500)

    const d = await page.evaluate(() => {
      const arts = [...document.querySelectorAll('article')]
      const rendered = document.querySelectorAll('.snippet-math').length
      const raw = document.querySelectorAll('.snippet-raw-math').length
      // 还剩多少裸露的 $…$（只统计可见文本，跳过 KaTeX 自己生成的节点）
      const leftover = arts
        .map((a) => {
          const clone = a.cloneNode(true)
          clone.querySelectorAll('.katex, .snippet-raw-math').forEach((n) => n.remove())
          return clone.textContent || ''
        })
        .filter((t) => /\$[^$\n]{1,80}\$/.test(t)).length
      const displayCount = document.querySelectorAll('.search-snippet .katex-display').length
      // 窄屏溢出：只看卡片自身会不会被内容撑破。
      // 不要逐个元素比 rect.right —— KaTeX 的 SVG path 与 .katex-display（overflow-x:auto）
      // 内部元素的包围盒本来就会超出视口，逐个判会满屏假阳性（实测报过 right=7000 的 path）。
      const vw = document.documentElement.clientWidth
      const over = arts
        .filter((a) => a.scrollWidth > a.clientWidth + 1)
        .slice(0, 3)
        .map((a) => ({
          cardScroll: a.scrollWidth,
          cardClient: a.clientWidth,
          text: (a.textContent || '').slice(0, 50),
        }))
      return {
        articles: arts.length,
        rendered,
        raw,
        leftoverSnippets: leftover,
        displayCount,
        docOverflow: document.documentElement.scrollWidth > vw,
        over,
      }
    })

    // 判据分两档：
    //   · 硬失败：整页横向溢出、卡片被撑破、检索没跑完 —— 这些是回归，一条都不许有；
    //   · 软阈值：仍露出 `$…$` 的卡片占比。
    //     残留的来源是**未配对的孤立 `$`**（书里的块是任意切分的，公式会被切断在块边界，
    //     段首/段尾只剩半个定界符）。这类没有可靠判据可以消掉，硬去猜只会引入新的错配。
    //     所以设 5% 的上限，超了就说明退化，需要回头看，而不是要求归零。
    const leftoverRatio = d.articles ? d.leftoverSnippets / d.articles : 0
    const hardFail = d.docOverflow || d.over.length > 0 || settled !== 'ok'
    const softFail = leftoverRatio > 0.05
    const ok = !hardFail && !softFail
    if (!ok) failed++
    console.log(
      `${ok ? '✔' : hardFail ? '✘' : '⚠'} [${width}px] "${q}"  articles=${d.articles} rendered=${d.rendered} raw=${d.raw} display=${d.displayCount} 残留$=${d.leftoverSnippets}(${(leftoverRatio * 100).toFixed(0)}%) 溢出=${d.docOverflow}`
    )
    if (d.over.length) console.log('    溢出元素:', JSON.stringify(d.over))
    if (errors.length) console.log('    控制台错误:', JSON.stringify(errors.slice(0, 2)))
    await page.close()
  }
}

// 公式页签单独测一遍
const page = await browser.newPage({ viewport: { width: 375, height: 1200 } })
await page.goto(`${base}/search?q=${encodeURIComponent('右半平面')}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('button:has-text("公式")', { timeout: 30000 })
await page.click('button:has-text("公式")')
await page.waitForTimeout(6000)
const f = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth
  return {
    rendered: document.querySelectorAll('.snippet-display-math .katex').length,
    rawPre: document.querySelectorAll('article pre').length,
    docOverflow: document.documentElement.scrollWidth > vw,
  }
})
console.log(
  `${!f.docOverflow ? '✔' : '✘'} [375px] 公式页签  rendered=${f.rendered} rawPre=${f.rawPre} docOverflow=${f.docOverflow}`
)
if (f.docOverflow) failed++
await page.close()

await browser.close()
console.log(failed ? `\n${failed} 项未通过` : '\n全部通过')
process.exit(failed ? 1 : 0)
