/**
 * 全库检索内核（纯前端，浏览器内完成）
 * ============================================================================
 * 为什么不用服务端那张 133.70 MiB 的 BM25 倒排（02_RAG知识库/index/bm25_index.json）：
 *
 *   ① 它是**纯布尔倒排**（term → chunk_id 列表），不含 tf/idf 权重，所以就算搬到
 *      客户端，排序还是要重新算一遍，等于只省了「找哪几条」；
 *   ② 中文词条有噪音 —— 索引里存在「但需要」「指出的」这类跨词碎片，
 *      用它召回反而会把长尾词打散；
 *   ③ 实测这个量级根本不需要倒排：17,292 条、1,627 万字符线性扫描，
 *      中位 3.5 ms、p95 8.5 ms、三词 AND 13.4 ms（见 05_工具脚本/诊断检查/
 *      bench_linear_search.mjs）。倒排的收益在这里抵不过它的体积与复杂度。
 *
 * 分词策略（这一段是本文件最要紧的设计，改之前先读完）
 * ---------------------------------------------------------------------------
 * 中文**不能**按 2-gram 切了再 AND。「右半平面零点」切出来是
 * 右半 / 半平 / 平面 / 面零 / 零点，而正文里很少同时出现「面零」这种跨词相邻，
 * AND 下去召回率会掉到接近 0。正确做法是：
 *
 *   · 中文连写片段**整段**当一个词，靠子串匹配天然支持短语；
 *   · 长问句先按**虚词**切开（为什么 / 的 / 是 / 有 …），只留实词片段；
 *   · 英文数字按非字母数字切，长度 ≥ 2 才收。
 *
 * 这样「为什么Boost有右半平面零点」能切成 [boost, 右半平面零点] 并命中；
 * 但它是**字面匹配**，不懂同义与推理 —— 页面上必须如实这么写，不许包装成语义检索。
 */
import { splitMathAware } from './mathText'

export interface BookRef {
  /** 书名，原样显示 */
  t: string
  /** 该书占多少块 */
  n: number
}

export interface Chunk {
  /** chunk_id */
  i: string
  /** 书名在 books 里的下标 */
  b: number
  /** 块在该书内的序号 */
  n: number
  /** 正文 */
  c: string
  /** 语言；chinese 省略（占比小，省体积） */
  g?: string
  /** 分类；「其他」省略 */
  k?: string
  /** 主题标签 */
  p?: string[]
}

export interface TextIndex {
  kind: 'text'
  built: string
  books: BookRef[]
  chunks: Chunk[]
}

export interface FormulaRow {
  /** 所属文档 */
  d: string
  /** 页码 */
  p: number
  /** LaTeX 原文（含 $$ 定界符） */
  l: string
  /** 式号，若有 */
  n?: string
  /** 上下文，已截断到 160 字 */
  x?: string
}

export interface FormulaIndex {
  kind: 'formula'
  built: string
  formulas: FormulaRow[]
}

/**
 * 中文虚词 / 疑问词。查询串在这上面切一刀，只留实词。
 * 这不是语义扩展，只是把「为什么」「的」「有」这类不承载检索意义的碎片剥掉，
 * 否则长问句会变成一个巨大的子串，命中率近乎 0。
 * 表要短而准：多放一个词就多切一刀，可能把真词切坏（如「有关」「有机」）。
 */
const STOPWORDS = [
  '为什么', '是什么', '怎么样', '怎么', '如何', '什么', '哪些', '哪个', '哪里',
  '请问', '请', '关于', '对于', '由于', '因此', '所以', '但是', '而且', '或者',
  '如果', '那么', '可以', '应该', '需要', '能否', '是否', '有没有', '有没有',
  '的', '了', '是', '在', '和', '与', '有', '没', '不', '也', '都', '还', '就',
  '而', '及', '或', '把', '被', '让', '给', '对', '从', '到', '这', '那', '其',
  '之', '吗', '呢', '吧', '啊', '把', '很', '太', '更', '最', '要', '会', '能',
]

/** 用于按「非检索字符」切分的字符类：空白、标点、常见连接符。 */
const SEP = /[\s,，。、;；:：!！?？()（）[\]【】{}「」『』<>《》"'“”‘’`~@#$%^&*+=|\\/·…—–\-]+/

/**
 * 把查询串切成检索词。
 *
 * 做法：先按标点/空白切成段 → 每段再按虚词切 → 丢掉长度 < 2 的中文残片
 * 与长度 < 2 的英文残片 → 去重（保序）。
 *
 * 单字中文（如「熵」「秩」）会保留：这类单字术语在控制领域是有效的检索词，
 * 直接按长度 ≥ 2 过滤会把它们误杀。
 */
export function tokenize(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  // 全角转半角（用户从 PDF 复制的文本常带全角字母数字）
  const normalized = q.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  )

  const out: string[] = []
  const seen = new Set<string>()

  for (let seg of normalized.split(SEP)) {
    seg = seg.trim()
    if (!seg) continue

    // 段内按虚词切（长词优先，避免「为什么」先被「为」切碎）
    const parts: string[] = []
    let cursor = seg
    const ordered = [...STOPWORDS].sort((a, b) => b.length - a.length)
    for (const sw of ordered) {
      if (!cursor.includes(sw)) continue
      cursor = cursor.split(sw).join('\u0000')
    }
    for (const p of cursor.split('\u0000')) {
      if (p) parts.push(p)
    }

    for (const p of parts) {
      const hasCJK = /[\u4e00-\u9fff]/.test(p)
      // 中文保留 ≥1 字（单字术语有效）；纯西文要求 ≥2 字符，避免 a / z 这种噪声
      if (hasCJK ? p.length >= 1 : p.length >= 2) {
        if (!seen.has(p)) {
          seen.add(p)
          out.push(p)
        }
      }
    }
  }

  return out
}

/** 预处理好的一行，避免每次搜索重复做小写化。 */
export interface PreparedChunk {
  chunk: Chunk
  /** 检索用小写文本。中文块 toLowerCase 无变化时直接复用原串，省一半内存。 */
  low: string
}

export interface Hit<T> {
  row: T
  /** 排序分，越大越靠前 */
  score: number
  /** 实际命中的检索词 */
  matched: string[]
  /** 展示用片段（原文，未加标记） */
  snippet: string
  /** 片段内命中区间，[start, end) 相对 snippet */
  ranges: Array<[number, number]>
}

const SNIPPET_RADIUS = 90
const MAX_HITS = 200

/**
 * 把片段边界贴到「公式段的边界」上，避免从公式中间切开。
 *
 * 为什么必须用 splitMathAware 而不是自己数 `$` 的奇偶：
 * 书里的块是任意切分的，公式会被切断在块边界，于是块内 `$` 个数可能为奇数（实测有 63 个的），
 * 配对整体错位一格。这时「从 0 数 `$` 的奇偶」得到的结论与页面实际采用的配对**不一致**，
 * 按它切边界等于白切（实测那条整卡源码的结果就是这样漏掉的）。
 * 用同一个分段函数，两边就一定对得上。
 *
 * 方向是**向内收**，不放宽：起点落在公式内就推到公式之后，终点落在公式内就退到公式之前。
 * 曾经试过向外扩到定界符外侧，结果 `$$…$$` 动辄几百字符，卡片被撑到 600 字以上，整页变得极长。
 * 唯一例外：收边界会越过命中的词时不动——宁可同框源码，也不能把命中切掉。
 */
function snapToMathBoundary(
  text: string,
  start0: number,
  end0: number,
  first: number
): [number, number] {
  // 绝大多数块没有公式，先挡掉，省下整块的分段开销
  if (!text.includes('$')) return [start0, end0]

  let start = start0
  let end = end0
  for (const g of splitMathAware(text)) {
    if (g.latex === null) continue
    if (g.s < start0 && start0 < g.e && g.e <= first) start = g.e
    else if (g.s < end0 && end0 < g.e && g.s >= first) end = g.s
  }
  return [start, end]
}

/** 统计 needle 在 hay 中出现的次数，上限 cap 防止病态输入拖垮。 */
function countOcc(hay: string, needle: string, cap = 30): number {
  let n = 0
  let at = hay.indexOf(needle)
  while (at >= 0 && n < cap) {
    n++
    at = hay.indexOf(needle, at + needle.length)
  }
  return n
}

/**
 * 文本检索：每个词一次全表扫描 → 取交集（AND）→ 打分。
 *
 * AND 而不是 OR：这个站的用户是在找「同时提到这两件事的段落」，
 * OR 会把 43 本书里所有沾边的块都倒出来，反而不可用。
 * 代价是某个词打错就 0 结果 —— 所以 UI 上要给出「哪个词没命中」的提示。
 */
export function searchText(
  index: TextIndex,
  prepared: PreparedChunk[],
  query: string
): { hits: Hit<Chunk>[]; missing: string[] } {
  const terms = tokenize(query)
  if (!terms.length) return { hits: [], missing: [] }

  // 每个词 → (chunk 下标 → 命中次数)
  const perTerm: Array<Map<number, number>> = []
  const missing: string[] = []

  for (const t of terms) {
    const m = new Map<number, number>()
    for (let k = 0; k < prepared.length; k++) {
      const n = countOcc(prepared[k].low, t)
      if (n > 0) m.set(k, n)
    }
    if (m.size === 0) missing.push(t)
    perTerm.push(m)
  }

  // 交集：只有全部词都命中的块才进候选
  let candidates: number[] | null = null
  for (const m of perTerm) {
    const keys = [...m.keys()]
    if (candidates === null) candidates = keys
    else {
      const keep = new Set(keys)
      candidates = candidates.filter((k) => keep.has(k))
    }
    if (candidates.length === 0) break
  }
  if (!candidates || !candidates.length) return { hits: [], missing }

  const hits: Hit<Chunk>[] = []
  for (const k of candidates) {
    const { chunk, low } = prepared[k]
    let score = 0
    const matched: string[] = []

    for (let ti = 0; ti < terms.length; ti++) {
      const t = terms[ti]
      const n = perTerm[ti].get(k) || 0
      if (!n) continue
      matched.push(t)
      // 对数压缩：出现 1 次和 10 次的差别不该是 10 倍
      score += Math.log(1 + n)
      // 西文词按词边界命中更可信（避免 compensator 命中 compensation 的前缀）
      if (!/[\u4e00-\u9fff]/.test(t) && new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(low)) {
        score += 0.8
      }
    }

    // 长度归一：短块天然容易高频，不压一下会全是目录页
    score /= 1 + Math.log(1 + chunk.c.length / 600)

    // 书名命中是强信号：用户搜「卡尔曼」时，书名带这词的块应当排前面
    const bookName = index.books[chunk.b]?.t.toLowerCase() || ''
    for (const t of terms) {
      if (bookName.includes(t)) {
        score += 1.2
        break
      }
    }
    // 主题标签命中
    if (chunk.p?.some((tag) => terms.some((t) => tag.toLowerCase().includes(t)))) {
      score += 0.6
    }

    const { snippet, ranges } = makeSnippet(chunk.c, low, terms)
    hits.push({ row: chunk, score, matched, snippet, ranges })
  }

  hits.sort((a, b) => b.score - a.score)
  return { hits: hits.slice(0, MAX_HITS), missing }
}

/** 以第一个命中词为中心截一段，并把所有命中词的区间算出来（前端自己加标记）。 */
function makeSnippet(
  text: string,
  low: string,
  terms: string[]
): { snippet: string; ranges: Array<[number, number]> } {
  let first = -1
  for (const t of terms) {
    const at = low.indexOf(t)
    if (at >= 0 && (first < 0 || at < first)) first = at
  }
  if (first < 0) return { snippet: text.slice(0, SNIPPET_RADIUS * 2), ranges: [] }

  const start0 = Math.max(0, first - SNIPPET_RADIUS)
  const end0 = Math.min(text.length, first + SNIPPET_RADIUS * 2)
  const [start, end] = snapToMathBoundary(text, start0, end0, first)

  const snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
  const offset = start > 0 ? 1 : 0

  // 在片段范围内标出所有命中
  const ranges: Array<[number, number]> = []
  for (const t of terms) {
    let at = low.indexOf(t, start)
    while (at >= 0 && at < end) {
      ranges.push([at - start + offset, at - start + offset + t.length])
      at = low.indexOf(t, at + t.length)
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  // 合并重叠区间，避免嵌套标记
  const merged: Array<[number, number]> = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return { snippet, ranges: merged }
}

/**
 * 公式检索。
 *
 * 与文本检索分开，因为公式的「正文」是 LaTeX：
 *   · `l` 里是 `$$ … $$` 原文，用户可能直接搜符号（`\omega_n`、`Z_o`）；
 *   · `x` 是 OCR 上下文，用户更常搜中文（「右半平面零点」）或英文术语。
 * 两路都查，命中 `x` 的权重更高 —— 符号匹配容易误中，而上下文命中语义更实。
 */
export function searchFormulas(
  index: FormulaIndex,
  query: string
): { hits: Hit<FormulaRow>[]; missing: string[] } {
  const terms = tokenize(query)
  if (!terms.length) return { hits: [], missing: [] }

  const hits: Hit<FormulaRow>[] = []
  const hitTerms = new Set<string>()

  for (const f of index.formulas) {
    const hayL = f.l.toLowerCase()
    const hayX = (f.x || '').toLowerCase()
    let score = 0
    const matched: string[] = []

    for (const t of terms) {
      const inL = countOcc(hayL, t, 10)
      const inX = countOcc(hayX, t, 10)
      if (!inL && !inX) continue
      matched.push(t)
      hitTerms.add(t)
      score += inL * 0.8 + inX * 1.4
    }
    if (!matched.length) continue

    // 式号命中也算（用户有时按「式 6-25」找）
    if (f.n && f.n.toLowerCase().includes(query.trim().toLowerCase())) score += 2

    hits.push({ row: f, score, matched, snippet: f.x || f.l, ranges: [] })
  }

  hits.sort((a, b) => b.score - a.score)
  const missing = terms.filter((t) => !hitTerms.has(t))
  return { hits: hits.slice(0, MAX_HITS), missing }
}

/** 加载时预处理一次：小写化 + 过滤掉正文为空的块。 */
export function prepare(index: TextIndex): PreparedChunk[] {
  const out: PreparedChunk[] = []
  for (const chunk of index.chunks) {
    const c = chunk.c
    if (!c || !c.trim()) continue
    // 中文块小写化后与原串完全相同，复用它省一次整串复制（1,627 万字符量级下有意义）
    const low = /[A-Z]/.test(c) ? c.toLowerCase() : c
    out.push({ chunk, low })
  }
  return out
}
