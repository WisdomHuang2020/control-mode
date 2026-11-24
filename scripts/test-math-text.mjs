#!/usr/bin/env node
/**
 * 「检索片段里的公式」离线校验。
 *
 * 为什么必须离线钉住：这一段逻辑的 bug 都是**静默**的——
 *   · 定界符配对错位 → 半句正文被吞进公式，页面上凭空少一段话；
 *   · 渲染失败没兜住 → 卡片里一片空白；
 *   · 高亮区间没跟着分段重算 → 命中词不亮，或者亮错位置。
 * 这些在页面上都只是「看起来不太对」，没有报错可看。所以钉成硬断言。
 *
 * 用法：node scripts/test-math-text.mjs     退出码 0 = 通过
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')

// ── 打包纯函数模块（含 katex 依赖）──
const tmp = path.join(os.tmpdir(), `math-text-test-${process.pid}`)
fs.mkdirSync(tmp, { recursive: true })
const entry = path.join(tmp, 'entry.ts')
fs.writeFileSync(entry, `export * from ${JSON.stringify(path.join(root, 'src/lib/mathText.ts'))}\n`)
const out = path.join(tmp, 'bundle.mjs')
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent',
})
const m = await import(pathToFileURL(out).href)

let pass = 0
const fails = []
function check(name, fn) {
  try {
    fn()
    pass++
  } catch (e) {
    fails.push(`${name}\n     ${e.message.split('\n')[0]}`)
  }
}

// ══════════════════════════════════════════════════════════════
// 1. 分段：定界符识别
// ══════════════════════════════════════════════════════════════
check('单个 $...$ 切成 3 段（正文/公式/正文）', () => {
  const segs = m.splitMathAware('负载极点位于 $ f p $ 处')
  assert.equal(segs.length, 3)
  assert.equal(segs[1].latex, 'f p')
  assert.equal(segs[0].latex, null)
  assert.equal(segs[2].latex, null)
})

check('$$...$$ 整体识别，不被单 $ 规则切碎', () => {
  const segs = m.splitMathAware('前 $$a=b$$ 后')
  const mathSegs = segs.filter((s) => s.latex !== null)
  assert.equal(mathSegs.length, 1, `期望 1 段公式，实际 ${mathSegs.length}`)
  assert.equal(mathSegs[0].latex, 'a=b')
  assert.equal(mathSegs[0].open, '$$')
  assert.equal(mathSegs[0].close, '$$')
})

check('\\[...\\] 也能识别', () => {
  const segs = m.splitMathAware('前 \\[x^2\\] 后')
  const mathSegs = segs.filter((s) => s.latex !== null)
  assert.equal(mathSegs.length, 1)
  assert.equal(mathSegs[0].latex, 'x^2')
})

check('不配对的单个 $ 退化为正文，不吞句子', () => {
  const text = '定价 $5 元的模块'
  const segs = m.splitMathAware(text)
  assert.equal(segs.length, 1, `期望整段正文，实际 ${segs.length} 段`)
  assert.equal(segs[0].latex, null)
  assert.equal(text.slice(segs[0].s, segs[0].e), text)
})

check('空内容 $$ 不当公式', () => {
  const segs = m.splitMathAware('前 $$ 后')
  assert.equal(segs.filter((s) => s.latex !== null).length, 0)
})

check('两个 $ 之间夹一整句（>500 字）不当公式，且定界符要丢掉', () => {
  const filler = '很长的正文'.repeat(120) // 600 字
  const text = `$ ${filler} $`
  const segs = m.splitMathAware(text)
  assert.equal(segs.filter((s) => s.latex !== null).length, 0, '超长片段应退化为正文')
  const shown = segs.map((s) => text.slice(s.s, s.e)).join('')
  assert.ok(!shown.includes('$'), '定界符应当丢弃')
})

check('块级公式可以比行内长得多（门槛 3000，不是 500）', () => {
  // 1200 字符的 $$ … $$ 应当仍是公式（多行方程组确实会这么长）
  const long = Array.from({ length: 60 }, (_, i) => `a_{${i}}=b_{${i}}`).join(',')
  assert.ok(long.length > 500 && long.length < 3000, `构造长度 ${long.length} 不在预期区间`)
  const segs = m.splitMathAware(`前 $$ ${long} $$ 后`)
  assert.equal(segs.filter((s) => s.latex !== null).length, 1, '块级长公式仍应被识别')
})

// ══════════════════════════════════════════════════════════════
// 1b. 定界符误配：块切分把公式切断后，`$$` 配对会整体错位一格，
//     结果把中间的中文论述吞进公式（实测块 fc52b9ba79fa 的 13 个 `$$`）。
//     KaTeX 不会报错（中文被当普通字符排），但整段中文会变成一条不能换行的公式，
//     375px 窄屏直接横向溢出。
// ══════════════════════════════════════════════════════════════
check('定界符里若是中文论述，要判为正文并丢掉两侧定界符', () => {
  const text = '前 $$（5.108）\n\n降压-升压变换器也存在右半平面零点，它会影响可用的带宽。 $$ 后'
  const segs = m.splitMathAware(text)
  assert.equal(segs.filter((s) => s.latex !== null).length, 0, '不该被当成公式')
  const shown = segs.map((s) => text.slice(s.s, s.e)).join('')
  assert.ok(shown.includes('降压-升压变换器也存在右半平面零点'), '正文内容必须保留')
  assert.ok(!shown.includes('$'), `定界符应当丢弃，实际显示：${JSON.stringify(shown.slice(0, 40))}`)
})

check('\\text{中文} 是合法写法，不能被误杀', () => {
  const text = '前 $K_{p}=\\text{增益}\\times 2$ 后'
  const segs = m.splitMathAware(text)
  assert.equal(segs.filter((s) => s.latex !== null).length, 1, '\\text 里带中文仍应算公式')
})

check('真实语料：任何公式段都不含成串中文', () => {
  const idxPath = path.join(root, 'public', 'search-data', 'index-text.json')
  const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'))
  const offenders = []
  for (const c of idx.chunks) {
    for (const g of m.splitMathAware(c.c || '')) {
      if (!g.latex) continue
      const bare = g.latex.replace(
        /\\(text|textrm|textnormal|textsf|texttt|mbox|hbox)\s*\{[^{}]*\}/g,
        ''
      )
      if (/[\u4e00-\u9fff]{3,}/.test(bare)) {
        offenders.push({ id: c.i, latex: g.latex.slice(0, 60) })
        if (offenders.length >= 3) break
      }
    }
    if (offenders.length >= 3) break
  }
  assert.equal(
    offenders.length,
    0,
    '仍有公式段含成串中文（说明误配没被拦住）：' + JSON.stringify(offenders)
  )
})

// ══════════════════════════════════════════════════════════════
// 2. 分段：覆盖不变式（最关键的一条）
//    段之间允许有「空洞」，但空洞只可能是被丢弃的定界符。
//    任何被静默吞掉的正文都会在这里失败。
// ══════════════════════════════════════════════════════════════
/** 空洞只允许是定界符：$ / $$ / \[ / \] */
const DELIM_ONLY = /^(?:\$+|\\\[|\\\])$/

function assertTiles(text, segs, label) {
  if (!text.length) {
    assert.equal(segs.length, 0, `${label}: 空文本不该产生段`)
    return
  }
  let prev = 0
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i]
    assert.ok(g.e > g.s, `${label}: 第 ${i} 段长度必须 > 0`)
    assert.ok(g.s >= prev, `${label}: 第 ${i} 段与上一段重叠`)
    const gap = text.slice(prev, g.s)
    assert.ok(
      !gap || DELIM_ONLY.test(gap),
      `${label}: 第 ${i} 段之前丢了非定界符内容 ${JSON.stringify(gap.slice(0, 30))}`
    )
    prev = g.e
  }
  const tail = text.slice(prev)
  assert.ok(
    !tail || DELIM_ONLY.test(tail),
    `${label}: 结尾丢了非定界符内容 ${JSON.stringify(tail.slice(0, 30))}`
  )
}

check('全覆盖：若干构造用例', () => {
  const cases = [
    '',
    '没有公式的一句普通正文。',
    '$a$',
    '$a$中间$b$',
    '前 $a$ 中 $$b$$ 后',
    '$$$$',
    '$ $',
    '只有一个 $ 符号',
    '末尾公式 $x$',
    '$x$ 开头',
    '\\[a\\] 与 $b$ 混排',
  ]
  cases.forEach((t, i) => assertTiles(t, m.splitMathAware(t), `用例${i}: ${JSON.stringify(t.slice(0, 20))}`))
})

check('全覆盖：真实语料 17,292 块逐块铺满', () => {
  const idxPath = path.join(root, 'public', 'search-data', 'index-text.json')
  assert.ok(fs.existsSync(idxPath), `索引不存在：${idxPath}`)
  const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'))
  for (const c of idx.chunks) {
    const t = c.c || ''
    if (!t) continue
    assertTiles(t, m.splitMathAware(t), `块 ${c.i}`)
  }
})

// ══════════════════════════════════════════════════════════════
// 3. 渲染
// ══════════════════════════════════════════════════════════════
check('正常行内公式能渲染，且 display=false', () => {
  const r = m.renderMathToHtml('\\frac{1}{2\\pi L}')
  assert.ok(r, '应当渲染成功')
  assert.equal(r.display, false)
  assert.ok(r.html.includes('katex'), '输出应当是 KaTeX 的 HTML')
})

check('\\begin{align} 只在 display 模式合法 → 自动回退到块级并成功', () => {
  const r = m.renderMathToHtml('\\begin{align}a&=b\\end{align}')
  assert.ok(r, '应当渲染成功（靠第二次按 display 试）')
  assert.equal(r.display, true)
})

check('\\tag 同理（实测占失败量大头）', () => {
  const r = m.renderMathToHtml('x=1\\tag{6-25}')
  assert.ok(r, '应当渲染成功')
  assert.equal(r.display, true)
})

check('OCR 缺反斜杠的残式必须返回 null（不许红字糊过去）', () => {
  assert.equal(m.renderMathToHtml('\\omegan'), null)
  assert.equal(m.renderMathToHtml('\\xin'), null)
  assert.equal(m.renderMathToHtml('\\frac{1}{D&#x27;}'), null)
})

check('块内混进的裸 $ 要被清掉（OCR 残留，实测救回 2,179 条）', () => {
  // $ 在数学模式里不可能合法，删掉是安全的
  const r = m.renderMathToHtml('\\frac{V}{D$R}')
  assert.ok(r, '清掉裸 $ 后应当能渲染')
  // 对照：不清的话原本是渲染不出来的
  assert.equal(m.renderMathToHtml('\\frac{V}{D\\$R}') !== null, true, '转义的 \\$ 应保留并可渲染')
})

check('\\$ 这种真美元符号不能被误删', () => {
  const r = m.renderMathToHtml('\\$5')
  assert.ok(r, '\\$ 应当能渲染成美元符号')
})

check('forceDisplay 时只试块级', () => {
  const r = m.renderMathToHtml('x^2', true)
  assert.ok(r)
  assert.equal(r.display, true)
})

check('空串返回 null', () => {
  assert.equal(m.renderMathToHtml(''), null)
  assert.equal(m.renderMathToHtml('   '), null)
})

// ══════════════════════════════════════════════════════════════
// 4. 定界符剥离
// ══════════════════════════════════════════════════════════════
check('stripMathDelimiters', () => {
  assert.equal(m.stripMathDelimiters('$$x$$'), 'x')
  assert.equal(m.stripMathDelimiters('$x$'), 'x')
  assert.equal(m.stripMathDelimiters('\\[x\\]'), 'x')
  assert.equal(m.stripMathDelimiters('x'), 'x')
  assert.equal(m.stripMathDelimiters('  $$ x $$  '), 'x')
})

// ══════════════════════════════════════════════════════════════
// 5. 高亮区间的局部投影
// ══════════════════════════════════════════════════════════════
check('localRanges 投影与裁剪', () => {
  // 段 [10, 20)，区间 [12, 15) → 局部 [2, 5)
  assert.deepEqual(m.localRanges(10, 10, [[12, 15]]), [[2, 5]])
  // 跨段边界要被裁到段内
  assert.deepEqual(m.localRanges(10, 10, [[5, 12]]), [[0, 2]])
  assert.deepEqual(m.localRanges(10, 10, [[18, 30]]), [[8, 10]])
  // 完全不重叠 → 无
  assert.deepEqual(m.localRanges(10, 10, [[0, 5]]), [])
  assert.deepEqual(m.localRanges(10, 10, [[20, 25]]), [])
})

check('overlapsAny', () => {
  assert.equal(m.overlapsAny(10, 20, [[15, 18]]), true)
  assert.equal(m.overlapsAny(10, 20, [[20, 25]]), false, '边界相接不算重叠')
  assert.equal(m.overlapsAny(10, 20, [[0, 10]]), false)
  assert.equal(m.overlapsAny(10, 20, []), false)
})

// ══════════════════════════════════════════════════════════════
// 6. 真实语料的渲染成功率（防回归：不许悄悄变差）
// ══════════════════════════════════════════════════════════════
check('真实语料渲染成功率 ≥ 98%', () => {
  const idxPath = path.join(root, 'public', 'search-data', 'index-text.json')
  const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'))
  const uniq = new Set()
  for (const c of idx.chunks) {
    for (const g of m.splitMathAware(c.c || '')) {
      if (g.latex) uniq.add(g.latex)
    }
  }
  let ok = 0
  for (const l of uniq) if (m.renderMathToHtml(l)) ok++
  const rate = ok / uniq.size
  console.log(
    `  去重公式 ${uniq.size} 条，可渲染 ${ok}（${(rate * 100).toFixed(1)}%）`
  )
  assert.ok(rate >= 0.98, `渲染成功率跌到 ${(rate * 100).toFixed(1)}%，低于 98%`)
})

check('公式索引按块级渲染成功率 ≥ 95%', () => {
  const p = path.join(root, 'public', 'search-data', 'index-formula.json')
  const fd = JSON.parse(fs.readFileSync(p, 'utf8'))
  let ok = 0
  for (const f of fd.formulas) {
    if (m.renderMathToHtml(f.l, true)) ok++
  }
  const rate = ok / fd.formulas.length
  console.log(`  公式 ${fd.formulas.length} 条，块级可渲染 ${ok}（${(rate * 100).toFixed(1)}%）`)
  assert.ok(rate >= 0.95, `公式页签渲染成功率跌到 ${(rate * 100).toFixed(1)}%，低于 95%`)
})

// ══════════════════════════════════════════════════════════════
// 7. 性能：整页极端情况不能卡死输入
// ══════════════════════════════════════════════════════════════
check('渲染 1000 条真实公式 < 800 ms', () => {
  const idxPath = path.join(root, 'public', 'search-data', 'index-text.json')
  const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'))
  const sample = []
  for (const c of idx.chunks) {
    for (const g of m.splitMathAware(c.c || '')) {
      if (g.latex) sample.push(g.latex)
      if (sample.length >= 200) break
    }
    if (sample.length >= 200) break
  }
  const t0 = performance.now()
  for (let i = 0; i < 1000; i++) m.renderMathToHtml(sample[i % sample.length])
  const ms = performance.now() - t0
  console.log(`  1000 次渲染 ${ms.toFixed(0)} ms`)
  assert.ok(ms < 800, `1000 次渲染用了 ${ms.toFixed(0)} ms，太慢`)
})

// ── 汇总 ──
console.log('')
if (fails.length) {
  console.log(`公式片段校验：${pass} 通过 / ${fails.length} 失败`)
  fails.forEach((f) => console.log('  ✗ ' + f))
  process.exit(1)
}
console.log(`公式片段校验：${pass} 通过 / 0 失败`)
