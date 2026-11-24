#!/usr/bin/env node
/**
 * 离线校验「前置知识」模块里的每一条 KaTeX 公式。
 *
 * 为什么需要它：章节正文里的公式是写在 TS 单引号字符串里的，
 * 而 LaTeX 大量使用反斜杠。两层转义一叠加就会出现「JS 把反斜杠吃掉」
 * 的静默损坏（本次就抓到一处：`\{X_n\\}` → JS 解析成 `{X_n\}` → KaTeX 花括号失配）。
 * 这种错误在浏览器里表现为一块红色报错框，肉眼扫一遍很容易漏。
 *
 * 用法：node validate-katex.mjs
 * 退出码 0 = 全部通过；非 0 = 有公式渲染失败。
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import os from 'node:os'
import katex from 'katex'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')   // scripts/ 的上一级是项目根
const tmp = path.join(os.tmpdir(), `prereq-validate-${process.pid}`)
fs.mkdirSync(tmp, { recursive: true })

// 把 data/prereq/*.ts 打成临时 mjs（只做类型擦除，不改逻辑）
const entry = path.join(tmp, 'entry.ts')
fs.writeFileSync(
  entry,
  `export * from ${JSON.stringify(path.join(root, 'src/data/prereq/index.ts'))}\n`
)
const out = path.join(tmp, 'bundle.mjs')
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent',
})
const mod = await import(pathToFileURL(out).href)

/** 收集模块里所有需要 KaTeX 渲染的字符串 */
const latexSources = []
for (const ch of mod.PREREQ_CHAPTERS) {
  const push = (where, s) => {
    if (typeof s === 'string' && s.includes('$')) latexSources.push({ chapter: ch.slug, where, text: s })
  }
  push('title', ch.title)
  push('tagline', ch.tagline)
  for (const g of ch.goal) push('goal', g)
  for (const b of ch.blocks) {
    if (b.t === 'p') push('p', b.x)
    if (b.t === 'h') push('h', b.x)
    if (b.t === 'f') {
      latexSources.push({ chapter: ch.slug, where: 'formula', text: b.latex, raw: true })
      push('formula-note', b.note)
    }
    if (b.t === 'list') b.items.forEach((it) => push('list', it))
    if (b.t === 'table') {
      b.head.forEach((h) => push('table-head', h))
      b.rows.forEach((r) => r.forEach((c) => push('table-cell', c)))
      push('table-caption', b.caption)
    }
    if (b.t === 'callout') push('callout', b.x)
    if (b.t === 'rule') push('rule', b.x)
    if (b.t === 'figure') {
      push('figure-caption', b.caption)
      push('figure-credit', b.credit)
    }
    if (b.t === 'video') {
      push('video-caption', b.caption)
      push('video-credit', b.credit)
    }
    if (b.t === 'demo') push('demo-caption', b.caption)
  }
  for (const p of ch.pitfalls) push('pitfall', p)
  for (const q of ch.quiz) {
    push('quiz-q', q.q)
    push('quiz-a', q.a)
  }
  for (const l of ch.links) push('link-note', l.note)
}

let fail = 0
let checked = 0
const problems = []

// 反向检查：TS 字符串里若出现 \t \n \r 等被 JS 吃掉的转义，LaTeX 仍可能「合法」，
// 但渲染出来是制表符/换行。所以除了 KaTeX 能否解析，还要查控制字符。
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/

for (const src of latexSources) {
  const segs = src.raw ? [src.text] : src.text.split(/\$([^$]+)\$/g).filter((_, i) => i % 2 === 1)
  for (const seg of segs) {
    if (!seg || !seg.trim()) continue
    checked++
    if (CTRL.test(seg)) {
      fail++
      problems.push({
        chapter: src.chapter,
        where: src.where,
        latex: seg,
        error: '含控制字符（疑似 \\t / \\n 被 JS 吃掉反斜杠）',
      })
      continue
    }
    try {
      katex.renderToString(seg, { throwOnError: true, displayMode: !!src.raw })
    } catch (e) {
      fail++
      problems.push({ chapter: src.chapter, where: src.where, latex: seg, error: String(e.message).split('\n')[0] })
    }
  }
}

// 反向检查：纯文本出口（title / tagline / where）里不应出现 $ 或 **
const plainLeaks = []
for (const ch of mod.PREREQ_CHAPTERS) {
  for (const [where, s] of [
    ['title', ch.title],
    ['tagline', ch.tagline],
  ]) {
    if (/\$|\*\*/.test(s)) plainLeaks.push({ chapter: ch.slug, where, text: s })
  }
  for (const s of ch.sources) {
    if (/\$|\*\*/.test(s.book) || /\$|\*\*/.test(s.where))
      plainLeaks.push({ chapter: ch.slug, where: 'source', text: `${s.book} ${s.where}` })
  }
}

console.log(`公式片段校验：${checked} 条，失败 ${fail} 条`)
for (const p of problems) {
  console.log(`  FAIL ${p.chapter} / ${p.where}\n       ${p.latex}\n       ${p.error}`)
}
console.log(`纯文本出口泄漏：${plainLeaks.length} 处`)
for (const p of plainLeaks) console.log(`  LEAK ${p.chapter} / ${p.where}: ${p.text}`)

fs.rmSync(tmp, { recursive: true, force: true })
process.exit(fail + plainLeaks.length > 0 ? 1 : 0)
