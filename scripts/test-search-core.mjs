#!/usr/bin/env node
/**
 * 离线校验「全库检索」内核：分词、召回、AND 语义、打分、片段高亮、耗时。
 *
 * 为什么需要它：这套检索是纯前端、无后端，出了错没有任何服务端日志可查；
 * 而最典型的错误是「静默召回为 0」——页面只会显示「没有命中」，
 * 读者会以为自己搜的词书里没有，实际上是把查询切错了。
 * 所以把三类行为钉成硬断言：
 *
 *   ① 长问句必须靠虚词切分退回实词命中（'为什么Boost有右半平面零点' 要能出结果）；
 *   ② AND 语义必须成立（多词命中的条数不能多于单词）；
 *   ③ 完全不存在的词必须返回 missing，而不是假装没搜。
 *
 * 用法：node scripts/test-search-core.mjs
 * 退出码 0 = 通过；非 0 = 有断言失败。
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')

// ── 打包 TS 内核 ─────────────────────────────────────────
const tmp = path.join(os.tmpdir(), `search-core-test-${process.pid}`)
fs.mkdirSync(tmp, { recursive: true })
const entry = path.join(tmp, 'entry.ts')
fs.writeFileSync(entry, `export * from ${JSON.stringify(path.join(root, 'src/lib/searchCore.ts'))}\n`)
const out = path.join(tmp, 'bundle.mjs')
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent',
})
const core = await import(pathToFileURL(out).href)

// ── 装载索引 ─────────────────────────────────────────────
const textPath = path.join(root, 'public', 'search-data', 'index-text.json')
const formulaPath = path.join(root, 'public', 'search-data', 'index-formula.json')
assert.ok(fs.existsSync(textPath), `索引不存在：${textPath}\n请先跑 05_工具脚本/构建索引/build_site_search_index.mjs`)
assert.ok(fs.existsSync(formulaPath), `索引不存在：${formulaPath}`)

const tLoad = performance.now()
const textIdx = JSON.parse(fs.readFileSync(textPath, 'utf8'))
const formulaIdx = JSON.parse(fs.readFileSync(formulaPath, 'utf8'))
const prepared = core.prepare(textIdx)
const loadMs = performance.now() - tLoad

let pass = 0
const fails = []
function check(name, fn) {
  try {
    fn()
    pass++
  } catch (e) {
    fails.push(`${name}：${e.message.split('\n')[0]}`)
  }
}

// ── ① 索引结构 ───────────────────────────────────────────
check('索引结构', () => {
  assert.equal(textIdx.kind, 'text')
  assert.equal(textIdx.chunks.length, 17292, `文本块应为 17292，实际 ${textIdx.chunks.length}`)
  assert.equal(textIdx.books.length, 43, `书应为 43 本，实际 ${textIdx.books.length}`)
  assert.equal(formulaIdx.kind, 'formula')
  assert.equal(formulaIdx.formulas.length, 20596, `公式应为 20596，实际 ${formulaIdx.formulas.length}`)
  // 每条都必须有可用正文与合法书名下标，否则页面上会渲染出「undefined」
  for (const c of textIdx.chunks) {
    assert.ok(c.c && c.c.length > 0, `块 ${c.i} 正文为空`)
    assert.ok(c.b >= 0 && c.b < textIdx.books.length, `块 ${c.i} 书名下标越界：${c.b}`)
  }
})

// ── ② 分词 ───────────────────────────────────────────────
check('分词·纯中文短语不拆', () => {
  const t = core.tokenize('右半平面零点')
  assert.deepEqual(t, ['右半平面零点'], `实际切出 ${JSON.stringify(t)}`)
})

check('分词·长问句剥虚词', () => {
  const t = core.tokenize('为什么Boost有右半平面零点')
  assert.ok(t.includes('boost'), `缺少 boost，实际 ${JSON.stringify(t)}`)
  assert.ok(t.includes('右半平面零点'), `缺少 右半平面零点，实际 ${JSON.stringify(t)}`)
  assert.ok(!t.includes('为什么'), `虚词「为什么」没被剥掉：${JSON.stringify(t)}`)
})

check('分词·英文与数字', () => {
  const t = core.tokenize('RHP zero')
  assert.deepEqual(t.sort(), ['rhp', 'zero'], `实际 ${JSON.stringify(t)}`)
})

check('分词·单字中文保留', () => {
  // 「熵」「秩」这类单字术语在控制领域有效，不能被长度过滤误杀
  const t = core.tokenize('秩')
  assert.deepEqual(t, ['秩'], `实际 ${JSON.stringify(t)}`)
})

check('分词·全角转半角', () => {
  const t = core.tokenize('ＺＶＳ')
  assert.deepEqual(t, ['zvs'], `实际 ${JSON.stringify(t)}`)
})

// ── ③ 召回 ───────────────────────────────────────────────
const cases = ['右半平面零点', '为什么Boost有右半平面零点', 'ZVS', 'compensator', '占空比', 'kalman']
for (const q of cases) {
  check(`召回非空·${q}`, () => {
    const r = core.searchText(textIdx, prepared, q)
    assert.ok(r.hits.length > 0, `0 命中（切词：${JSON.stringify(core.tokenize(q))}）`)
  })
}

check('召回·不存在的词必须报 missing', () => {
  const r = core.searchText(textIdx, prepared, '阿巴阿巴不存在的词')
  assert.equal(r.hits.length, 0, '不该有命中')
  assert.ok(r.missing.length > 0, 'missing 必须非空，否则页面无法提示哪个词没找到')
})

check('AND 语义·多词命中不多于单词', () => {
  const one = core.searchText(textIdx, prepared, 'Buck')
  const three = core.searchText(textIdx, prepared, 'Buck 电感 传递函数')
  assert.ok(
    three.hits.length <= one.hits.length,
    `三词命中 ${three.hits.length} 竟多于单词 ${one.hits.length}`
  )
})

// ── ④ 打分与片段 ─────────────────────────────────────────
check('打分·结果按分数降序', () => {
  const r = core.searchText(textIdx, prepared, '补偿器')
  for (let i = 1; i < r.hits.length; i++) {
    assert.ok(r.hits[i - 1].score >= r.hits[i].score, `第 ${i} 位分数逆序`)
  }
})

check('片段·命中区间落在片段范围内', () => {
  const r = core.searchText(textIdx, prepared, '右半平面零点')
  for (const h of r.hits.slice(0, 40)) {
    for (const [s, e] of h.ranges) {
      assert.ok(s >= 0 && e <= h.snippet.length && s < e, `区间 [${s},${e}) 越界（片段长 ${h.snippet.length}）`)
    }
    // 区间必须覆盖真实命中词，不能标到别处
    for (const [s, e] of h.ranges) {
      const marked = h.snippet.slice(s, e).toLowerCase()
      assert.ok(marked.includes('右半') || marked.includes('零点') || marked.includes('平面'), `标记内容不像命中词：${marked}`)
    }
  }
})

check('片段·首条结果确实含查询词', () => {
  const r = core.searchText(textIdx, prepared, 'ZVS')
  const top = r.hits[0]
  assert.ok(top.snippet.toLowerCase().includes('zvs'), '首条结果的片段里没有 ZVS')
})

// ── ⑤ 公式 ───────────────────────────────────────────────
check('公式·上下文命中', () => {
  const r = core.searchFormulas(formulaIdx, '右半平面')
  assert.ok(r.hits.length > 0, '0 命中')
})

check('公式·LaTeX 符号命中', () => {
  const r = core.searchFormulas(formulaIdx, 'omega')
  assert.ok(r.hits.length > 0, '0 命中')
})

// ── ⑥ 性能（宽松阈值，CI 机器比本机慢） ──────────────────
check('性能·单查询 < 300 ms', () => {
  const t0 = performance.now()
  core.searchText(textIdx, prepared, '峰值电流模式 斜坡补偿')
  const ms = performance.now() - t0
  assert.ok(ms < 300, `实际 ${ms.toFixed(1)} ms`)
})

// ── 报告 ─────────────────────────────────────────────────
const t0 = performance.now()
core.searchText(textIdx, prepared, '右半平面零点')
const sampleMs = performance.now() - t0

console.log('全库检索内核校验')
console.log(`  索引装载        ${loadMs.toFixed(0)} ms（${textIdx.chunks.length} 块 / ${formulaIdx.formulas.length} 条公式）`)
console.log(`  抽样查询耗时    ${sampleMs.toFixed(1)} ms（「右半平面零点」）`)
console.log(`  断言            ${pass} 通过 / ${fails.length} 失败`)
for (const f of fails) console.log(`  ✘ ${f}`)

fs.rmSync(tmp, { recursive: true, force: true })
if (fails.length) process.exit(1)
