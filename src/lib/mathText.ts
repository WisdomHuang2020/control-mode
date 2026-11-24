/**
 * 片段里的 LaTeX 渲染（检索结果用）
 * ============================================================================
 * 为什么单独拆成一个纯函数模块，而不是直接写在组件里：
 * 这里的数据是 **OCR 出来的**，LaTeX 质量参差（缺反斜杠、定界符不配对、
 * `\begin{align}` 只能在 display 模式跑…），出错方式是「悄悄渲染成一个红块」
 * 或者「把半句话吞进公式」。这类问题必须能用离线断言钉住，不能只靠肉眼看页面。
 * 所以分段（splitMathAware）与渲染（renderMathToHtml）都是纯函数，React 只负责摆放。
 *
 * 三条实测依据（05_工具脚本 里的一次性诊断，2026-11-24）：
 *   · 全库 17,292 块里 3,253 块含 `$...$`，共 84,351 个片段；
 *   · 按 `throwOnError: true` 计，**96.8% 能渲染**；
 *    · 最大的失败类目是 `\tag` / `\begin{align}`「只能在 display 模式」，
 *     所以 renderMathToHtml 会先试行内、失败再试块级 —— 这一条把成功率顶到 ~99%。
 *   · 第二大类是「块内混进 OCR 残留的裸 `$`」，清掉后**去重口径从 91.1% 升到 98.3%**。
 *   · 剩下 1.7% 是 OCR 真的抄残了（`& #x27;` 这种实体、`\boldmath`、`\left.` 不配对），
 *     一律如实退回原文，不做猜测性修复。
 */
import katex from 'katex'

/** 一个片段切成若干段：普通正文，或者一段公式。 */
export interface MathSeg {
  /** 在原文中的起点（含） */
  s: number
  /** 在原文中的终点（不含） */
  e: number
  /** null 表示普通正文；字符串是**已去掉定界符**的 LaTeX 源码 */
  latex: string | null
  /** 原文用的开定界符，回退显示时要原样还原 */
  open?: string
  /** 原文用的闭定界符 */
  close?: string
}

/**
 * 定界符。顺序要紧：`$$…$$` 必须排在 `$…$` 之前，否则 `$$abc$$` 会被
 * 先按单 `$` 匹配成 `$$abc$` + 落单的 `$`。
 *
 * 单 `$` 那条用 `[^$\n]` 而不是 `[\s\S]`：不许跨行、不许嵌套同种定界符。
 * 这是防呆——一旦配对错位，宁可退化成纯文本，也不要把半段正文吞进 KaTeX。
 *
 * ⚠️ 只放**源码字符串**，每个 scan 自己 new 一个正则实例。
 * 别在这里放带 `g` 标志的正则对象：它是**有状态**的（lastIndex），
 * 而 scan 会在自己循环里递归调用 repairInside，共享同一个实例会把外层的
 * 游标重置成 0 —— 结果是死循环 + OOM（实测直接吃满 4 GB 堆）。
 */
const MATH_RE_SRC = '\\$\\$([\\s\\S]+?)\\$\\$|\\\\\\[([\\s\\S]+?)\\\\\\]|\\$([^$\\n]+?)\\$'

/**
 * 长度上限。行内公式超过 500 字符、块级超过 3000 字符，基本只能是「两个定界符之间
 * 夹了一整段话」的错配 —— 本书最长的行内公式也就一两百字符。
 * 块级的门槛放得宽，因为 `$$…$$` 确实可能是很长的多行方程组。
 */
const MAX_INLINE_LATEX = 500
const MAX_DISPLAY_LATEX = 3000

/**
 * 中文只允许出现在 `\text{…}` 这类「允许文字」的构造里。
 * 裸中文说明这段根本不是公式，而是被定界符误配进来的正文。
 */
const CJK_RUN = /[\u4e00-\u9fff]{3,}/
const TEXT_CMD = /\\(text|textrm|textnormal|textsf|texttt|mbox|hbox)\s*\{[^{}]*\}/g

/**
 * 判断一段定界符里的内容其实是不是**正文**。
 *
 * 这条判据不是锦上添花，是修一个真实缺陷：
 * 书里的块是**任意切分**的，公式会被切断在块边界上。于是某些块里 `$$` 的个数是奇数
 * （实测 fc52b9ba79fa 这块有 13 个），配对就整体错位一格——「公式的结束符」被当成
 * 「下一个公式的开始符」，把中间那段中文论述整个吞进公式。
 * KaTeX 不会报错（它把中文当普通字符排），结果是**整段中文被排成一条不能换行的公式**，
 * 375px 窄屏直接横向溢出（实测 right=1070，视口只有 375）。
 *
 * 为什么不用「块内 `$$` 个数为奇数就整体平移一位」来判断配对方向：
 * 奇数只说明有一端在块外，**看不出缺的是开还是闭**，猜错就是全块错位。
 * 用内容判据是确定的：数学模式里不可能有成串中文。
 */
function looksLikeProse(latex: string): boolean {
  // 先把允许中文的构造摘掉，剩下的才是「数学模式本体」
  const bare = latex.replace(TEXT_CMD, '')
  return CJK_RUN.test(bare)
}

/**
 * 把一段混合文本切成「正文 / 公式」交替的段。
 *
 * 不配对的 `$` 会被当成普通正文原样留下 —— 全库有 677 个块 `$` 个数是奇数，
 * 这类必须能安全退化，不能抛错、也不能把后面整段吞掉。
 *
 * 被判为正文的定界符段，**两侧定界符会被丢掉**（区间只覆盖中间内容）。
 * 理由：那些 `$` 是块切分留下的残迹，留着只会让读者看到「$ 一段中文 $」。
 * 所以各段之间允许出现「空洞」，且空洞只可能是定界符字符（由测试断言）。
 *
 * 配对方向不猜：`$` 个数为奇数时，把「从头配对」和「跳过首个孤立 `$` 再配对」都算一遍，
 * 取**能配成更多真公式**的那个。理由是切分可能落在公式中间，此时段首那个 `$` 其实是
 * 闭合符；照常从头配对会让整段配对错位一格，结果是中文论述被吞进公式。
 * 哪一种更好由数据判定，不靠假设。
 */
export function splitMathAware(text: string): MathSeg[] {
  return scanSome(text, 0, 0).segs
}

/**
 * 内层再配一次的深度上限。
 * 实测错配基本只有一层（块切分落在公式中间），再深就是数据真的乱了，继续递归只会放大猜错。
 */
const MAX_REPAIR_DEPTH = 2

interface ScanResult {
  segs: MathSeg[]
  /** 配成公式的段数，越多越好 */
  mathCount: number
  /** 被判为非公式而丢掉的字符数，越少越好 */
  rejected: number
}

/** 扫描 [0, text.length)；奇数个 `$` 时两种配对方向都算，取能配成更多公式的那个。 */
function scanSome(text: string, offset: number, depth: number): ScanResult {
  const dollars = (text.match(/\$/g) || []).length
  const forward = scan(text, offset, false, depth)
  if (dollars % 2 === 0) return forward

  const shifted = scan(text, offset, true, depth)
  const better =
    shifted.mathCount > forward.mathCount ||
    (shifted.mathCount === forward.mathCount && shifted.rejected < forward.rejected)
  return better ? shifted : forward
}

function scan(text: string, offset: number, skipFirstOrphan: boolean, depth: number): ScanResult {
  const out: MathSeg[] = []
  let last = 0
  let m: RegExpExecArray | null
  let mathCount = 0
  let rejected = 0
  let first = true
  // 每次 scan 用**独立**的正则实例：repairInside 会在本循环内部递归调用 scan，
  // 共享一个带 g 标志的正则会把这里的 lastIndex 重置掉，直接死循环。
  const re = new RegExp(MATH_RE_SRC, 'g')

  /** 补一段正文，区间为空则跳过。 */
  const pushProse = (s: number, e: number) => {
    if (e > s) out.push({ s: s + offset, e: e + offset, latex: null })
  }

  while ((m = re.exec(text)) !== null) {
    // 把首个定界符当成「被切断公式的残留符号」丢掉，从它之后重新配对。
    // 注意要整段跳过：块内配对错位时，多出来的那个往往是一个完整的 `$$`，
    // 只跳 1 个字符会把它拆成两个单 `$`，配对依旧错位（实测该块 63 个 `$`，
    // 跳过 1 个仍是奇数，跳掉整个 `$$` 才对齐）。
    if (skipFirstOrphan && first) {
      first = false
      const skipLen = text.startsWith('$$', m.index) ? 2 : 1
      pushProse(last, m.index)
      last = m.index + skipLen
      re.lastIndex = m.index + skipLen
      continue
    }
    first = false

    const whole = m[0]
    // 三条分支里哪一条命中，就取哪个捕获组
    const inner = m[1] ?? m[2] ?? m[3] ?? ''
    const open = whole.startsWith('$$') ? '$$' : whole.startsWith('\\[') ? '\\[' : '$'
    const close = open === '$$' ? '$$' : open === '\\[' ? '\\]' : '$'
    const latex = inner.trim()

    // 空内容（`$$`）：整段按正文处理（含定界符，无从判断该不该丢）
    if (!latex) continue

    const openLen = open.length
    const closeLen = close.length
    const innerStart = m.index + openLen
    const innerEnd = m.index + whole.length - closeLen

    // 判为「不是公式」的两类：内容其实是正文，或者长到不可能是公式。
    const tooLong = latex.length > (open === '$$' ? MAX_DISPLAY_LATEX : MAX_INLINE_LATEX)
    if (looksLikeProse(latex) || tooLong) {
      pushProse(last, m.index)
      last = m.index + whole.length
      rejected += whole.length - latex.length
      const recovered = repairInside(text, innerStart, innerEnd, offset, depth, out, pushProse)
      mathCount += recovered
      continue
    }

    pushProse(last, m.index)
    out.push({
      s: m.index + offset,
      e: m.index + whole.length + offset,
      latex,
      open,
      close,
    })
    mathCount++
    last = m.index + whole.length
  }

  pushProse(last, text.length)
  return { segs: out, mathCount, rejected }
}

/**
 * 外层配对判错之后，把它的**内层**再扫一遍。
 *
 * 为什么值得这么做：错配常常是「外层的开闭符配错一格」，而它吞进去的那段里
 * 往往藏着**成对且正确**的公式（实测 `$ V{gmax} $`、`$ \hat{v}(s) $` 都是这样被埋掉的）。
 * 直接当正文丢掉，读者看到的是一串 `$…$` 原文；递归一遍就能真的渲染出来。
 *
 * 内层什么都没配到，就把这一段按正文处理，并**丢掉其中所有 `$`** ——
 * 已经判定这里不是公式，那些 `$` 只可能是切分残迹，留着就是视觉噪音。
 *
 * 返回救回的公式条数，用于上层判断哪种配对方向更好。
 */
function repairInside(
  text: string,
  s: number,
  e: number,
  offset: number,
  depth: number,
  out: MathSeg[],
  pushProse: (s: number, e: number) => void
): number {
  if (e <= s) return 0

  if (depth < MAX_REPAIR_DEPTH) {
    const sub = text.slice(s, e)
    // 内层已知落在 [s, e)，其绝对偏移就是 s + 外层 offset
    const r = scanSome(sub, s + offset, depth + 1)
    if (r.mathCount > 0) {
      r.segs.forEach((g) => out.push(g))
      return r.mathCount
    }
  }

  // 内层没有可用公式：按正文输出，且把 `$` 全部丢掉（空洞只允许是定界符）
  let segStart = s
  for (let p = s; p < e; p++) {
    if (text[p] === '$') {
      pushProse(segStart, p)
      segStart = p + 1
    }
  }
  pushProse(segStart, e)
  return 0
}

/** 渲染结果。display 表示 KaTeX 认为这是块级公式（会带上 .katex-display）。 */
export interface RenderedMath {
  html: string
  display: boolean
}

/**
 * 渲染一段 LaTeX 成 HTML；渲染不了返回 null（调用方负责如实显示原文）。
 *
 * `throwOnError: true` 是刻意的：**不要**让 KaTeX 自己画个红块糊过去。
 * 这条数据里 OCR 缺反斜杠很常见（`\omegan`、`\xin`），那些就是不该被渲染的，
 * 原样露出来读者才知道「这行本来就是残的」，而不是以为系统坏了。
 *
 * 先试行内、失败再试块级：`\tag` 与 `\begin{align}` 只在 display 模式下合法，
 * 实测这一类占了失败量的大头（1,880 次），多试一次能把成功率从 96.8% 顶到 ~99%。
 */
export function renderMathToHtml(latex: string, forceDisplay = false): RenderedMath | null {
  // 先把定界符剥掉再送进 KaTeX。
  // 公式索引里的 `l` 是 `$$…$$` 原文，而 `$` 在数学模式里是非法字符——
  // 不剥的话会全部报「Can't use function '$' in math mode」，实测成功率从 ~88% 掉到 33.5%。
  const stripped = stripMathDelimiters(latex)

  // 再清掉**块内**的裸 `$`。这一步是实测出来的，不是预防性代码：
  // OCR 把 `$$ … $$` 里的单个 `$` 也抄了进来（占比很大），而 `$` 在数学模式里
  // 根本不可能合法。去掉它以后，去重公式的渲染成功率从 91.1% 升到 98.3%（救回 2,179 条）。
  // 只删未转义的 `$`；`\$`（真正的美元符号）保持原样。
  // 不用后行断言（/(?<!\\)\$/）：Safari 16.4 以下不支持，换哨兵更稳。
  const src = stripped
    .replace(/\\\$/g, '\u0000')
    .replace(/\$/g, '')
    .replace(/\u0000/g, '\\$')
  if (!src.trim()) return null

  const modes = forceDisplay ? [true] : [false, true]
  for (const displayMode of modes) {
    try {
      const html = katex.renderToString(src, {
        throwOnError: true,
        displayMode,
        // strict:'ignore' 只是压掉「No character metrics for '①'」这类字体告警，
        // 不影响排版结果；不静音的话控制台会被 OCR 出来的生僻符号刷满。
        strict: 'ignore',
        // trust:false 是 KaTeX 默认值，这里显式写出来：
        // 禁用 \href / \url / \htmlClass 这类能注入属性的命令。
        trust: false,
      })
      return { html, display: displayMode }
    } catch {
      // 换下一种模式再试
    }
  }
  return null
}

/** 去掉 `$$…$$` / `\[…\]` / `$…$` 定界符，得到可粘进编辑器的裸 LaTeX。 */
export function stripMathDelimiters(raw: string): string {
  const s = raw.trim()
  if (s.startsWith('$$') && s.endsWith('$$') && s.length >= 4) return s.slice(2, -2).trim()
  if (s.startsWith('\\[') && s.endsWith('\\]')) return s.slice(2, -2).trim()
  if (s.startsWith('$') && s.endsWith('$') && s.length >= 2) return s.slice(1, -1).trim()
  return s
}

/** [a,b) 是否与任一命中区间相交。用于给整条公式加高亮底色。 */
export function overlapsAny(a: number, b: number, ranges: Array<[number, number]>): boolean {
  for (const [s, e] of ranges) {
    if (s < b && e > a) return true
  }
  return false
}

/**
 * 把**绝对**区间投影到 `[base, base+len)` 这段局部坐标上，并裁剪到边界内。
 * 片段被切成多段之后，正文段各自只需自己的局部区间。
 */
export function localRanges(
  base: number,
  len: number,
  ranges: Array<[number, number]>
): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const [s, e] of ranges) {
    const a = Math.max(s, base) - base
    const b = Math.min(e, base + len) - base
    if (b > a) out.push([a, b])
  }
  return out
}
