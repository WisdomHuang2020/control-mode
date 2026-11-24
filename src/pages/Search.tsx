import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookOpen, Loader2, Search as SearchIcon, Sigma } from 'lucide-react'
import MathText, { DisplayMath } from '../components/MathText'
import {
  type FormulaIndex,
  type Hit,
  type PreparedChunk,
  type TextIndex,
  prepare,
  searchFormulas,
  searchText,
  tokenize,
} from '../lib/searchCore'

/**
 * 全库检索页。
 *
 * 两条硬约束写在最前面，改这个文件前先读：
 *
 *   ① **这是字面匹配，不是语义检索。** 术语（ZVS、右半平面零点、compensator）查得准，
 *      但自然语言长问句只能靠虚词切分退回实词 AND —— 它不懂同义、不懂推理。
 *      页面上必须如实这么写，不许包装成「智能问答」。
 *
 *   ② **不占首页。** 文 + 公式合计 28.87 MB 原始（gzip 6.85 MB），
 *      压在首页会把首屏拖死。所以做成独立路由，且只在进入本页时才下载。
 */

/**
 * 索引文件放在 public/search-data/。
 * 目录名**不能**叫 search —— 站点路由就是 /search，nginx 会优先把同名真实目录
 * 301 到 /search/ 并因缺 index 返回 403，整条路由失效（2026-11-24 上线后实测踩到）。
 */
const TEXT_URL = '/search-data/index-text.json'
const FORMULA_URL = '/search-data/index-formula.json'

type LoadStage = 'idle' | 'loading' | 'parsing' | 'ready' | 'error'

interface LoadState {
  stage: LoadStage
  /** 已下载字节（gzip 传输，浏览器解压后计数会略大于压缩体积，只用于显示进度感） */
  bytes: number
  error?: string
}

/**
 * 带进度的 JSON 拉取。
 *
 * 为什么要自己读流：这两个文件 gzip 后仍有 5.5 MB / 1.35 MB，
 * 一次 `await res.json()` 会让用户盯着空白页好几秒，没有任何反馈。
 * 读流能边下边报量，至少让人知道它在动。
 */
async function fetchJsonWithProgress<T>(
  url: string,
  onProgress: (bytes: number) => void
): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}（${url}）`)

  // 后端未部署 / 路由兜底时，nginx 的 try_files 会返回 200 + index.html，
  // 不能只看 res.ok —— 否则会把整页 HTML 当 JSON 解析，报一句莫名其妙的语法错误。
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('json')) {
    throw new Error(`返回的不是 JSON（Content-Type: ${ct || '空'}），索引文件可能未部署`)
  }

  if (!res.body) return (await res.json()) as T

  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      parts.push(value)
      got += value.length
      onProgress(got)
    }
  }
  const text = await new Blob(parts as BlobPart[]).text()
  return JSON.parse(text) as T
}

/**
 * 片段渲染：正文走 React 节点、公式走 KaTeX（见 components/MathText.tsx）。
 * 早先这里只有一个纯文本 Highlight，`$...$` 会原样露在结果里 ——
 * 而这个库 19% 的块含 LaTeX，露原文等于把最要紧的内容丢掉。
 */

export default function Search() {
  const [params, setParams] = useSearchParams()
  const [textIdx, setTextIdx] = useState<TextIndex | null>(null)
  const [prepared, setPrepared] = useState<PreparedChunk[] | null>(null)
  const [formulaIdx, setFormulaIdx] = useState<FormulaIndex | null>(null)
  const [textLoad, setTextLoad] = useState<LoadState>({ stage: 'idle', bytes: 0 })
  const [formulaLoad, setFormulaLoad] = useState<LoadState>({ stage: 'idle', bytes: 0 })
  const [tab, setTab] = useState<'text' | 'formula'>('text')

  const [input, setInput] = useState(params.get('q') || '')
  const [query, setQuery] = useState(input)
  const [searchMs, setSearchMs] = useState<number | null>(null)
  const startedText = useRef(false)
  const startedFormula = useRef(false)

  // ── 文本索引：进页面就加载 ──────────────────────────────
  useEffect(() => {
    if (startedText.current) return
    startedText.current = true
    setTextLoad({ stage: 'loading', bytes: 0 })
    fetchJsonWithProgress<TextIndex>(TEXT_URL, (n) =>
      setTextLoad({ stage: 'loading', bytes: n })
    )
      .then((idx) => {
        setTextLoad({ stage: 'parsing', bytes: 0 })
        // 让浏览器先把「解析中」画出来，再做重活
        setTimeout(() => {
          const p = prepare(idx)
          setTextIdx(idx)
          setPrepared(p)
          setTextLoad({ stage: 'ready', bytes: 0 })
        }, 0)
      })
      .catch((e: Error) => setTextLoad({ stage: 'error', bytes: 0, error: e.message }))
  }, [])

  // ── 公式索引：切到公式页才加载 ──────────────────────────
  useEffect(() => {
    if (tab !== 'formula' || startedFormula.current) return
    startedFormula.current = true
    setFormulaLoad({ stage: 'loading', bytes: 0 })
    fetchJsonWithProgress<FormulaIndex>(FORMULA_URL, (n) =>
      setFormulaLoad({ stage: 'loading', bytes: n })
    )
      .then((idx) => {
        setFormulaIdx(idx)
        setFormulaLoad({ stage: 'ready', bytes: 0 })
      })
      .catch((e: Error) => setFormulaLoad({ stage: 'error', bytes: 0, error: e.message }))
  }, [tab])

  // 输入防抖：每敲一个字就全表扫一遍太浪费，250 ms 足够
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(input)
      if (input.trim()) {
        setParams({ q: input.trim() }, { replace: true })
      } else {
        setParams({}, { replace: true })
      }
    }, 250)
    return () => clearTimeout(t)
  }, [input, setParams])

  const textResult = useMemo(() => {
    if (!prepared || !textIdx || !query.trim()) return null
    const t0 = performance.now()
    const r = searchText(textIdx, prepared, query)
    setSearchMs(performance.now() - t0)
    return r
  }, [prepared, textIdx, query])

  const formulaResult = useMemo(() => {
    if (!formulaIdx || !query.trim()) return null
    return searchFormulas(formulaIdx, query)
  }, [formulaIdx, query])

  const terms = useMemo(() => tokenize(query), [query])

  const onPick = useCallback((q: string) => setInput(q), [])

  const textStats = textIdx
    ? `${textIdx.chunks.length.toLocaleString()} 块 · ${textIdx.books.length} 本书`
    : ''
  const formulaStats = formulaIdx ? `${formulaIdx.formulas.length.toLocaleString()} 条` : ''

  const active = tab === 'text' ? textLoad : formulaLoad
  const notReady = active.stage !== 'ready'

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <header className="max-w-3xl">
        <div className="font-mono text-xs tracking-[0.2em] text-primary-light uppercase mb-4">
          SEARCH · 全库检索
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">在 43 本书里找那一句话</h1>
        <p className="mt-3 text-text-secondary leading-relaxed">
          跨 43 份资料的书内全文检索，在浏览器里跑，不上传任何查询。
          输入术语、书名、式号都可以；多个词用空格隔开，含义是「同一段里都要出现」。
        </p>

        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-text-secondary">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-primary-light" />
          <p>
            <strong className="text-text-primary">这是字面检索，不是语义问答。</strong>
            术语查得准（<code className="font-mono text-xs">ZVS</code>、
            <code className="font-mono text-xs">右半平面零点</code>、
            <code className="font-mono text-xs">compensator</code>），
            但长问句会被拆成实词再逐个匹配——它不懂同义替换，也不做推理。
            问「为什么 Boost 有右半平面零点」不如搜「Boost 右半平面零点」。
          </p>
        </div>
      </header>

      {/* 检索框 */}
      <div className="mt-8">
        <div className="relative">
          <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如：右半平面零点 / RHP zero / 峰值电流模式 斜坡补偿"
            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface border border-border focus:border-primary focus:outline-none text-text-primary placeholder:text-text-muted"
            autoFocus
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setTab('text')}
              className={`px-3.5 py-1.5 inline-flex items-center gap-1.5 transition-colors ${
                tab === 'text' ? 'bg-primary/15 text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> 正文 {textStats && `· ${textStats}`}
            </button>
            <button
              onClick={() => setTab('formula')}
              className={`px-3.5 py-1.5 inline-flex items-center gap-1.5 transition-colors border-l border-border ${
                tab === 'formula' ? 'bg-primary/15 text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Sigma className="w-3.5 h-3.5" /> 公式 {formulaStats && `· ${formulaStats}`}
            </button>
          </div>

          {terms.length > 0 && (
            <span className="text-text-muted">
              切出 {terms.length} 个检索词：
              {terms.map((t) => (
                <code key={t} className="ml-1 font-mono text-xs px-1.5 py-0.5 rounded bg-surface-elevated">
                  {t}
                </code>
              ))}
            </span>
          )}
          {searchMs != null && tab === 'text' && active.stage === 'ready' && (
            <span className="text-text-muted font-mono text-xs">{searchMs.toFixed(1)} ms</span>
          )}
        </div>

        {/* 索引加载状态 */}
        {notReady && (
          <div className="mt-4 card-surface p-4 text-sm text-text-secondary">
            {active.stage === 'error' ? (
              <p className="text-danger">索引加载失败：{active.error}</p>
            ) : (
              <p className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary-light" />
                {active.stage === 'parsing'
                  ? '正在建立内存索引…'
                  : `正在载入${tab === 'text' ? '正文' : '公式'}索引 ${
                      active.bytes ? `（已接收 ${(active.bytes / 1048576).toFixed(1)} MB）` : ''
                    }`}
                <span className="text-text-muted">
                  {' '}
                  · 首次进入需下载一次，之后走浏览器缓存
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* 结果 */}
      <div className="mt-8">
        {!query.trim() && active.stage === 'ready' && (
          <div className="text-sm text-text-muted leading-relaxed">
            <p>索引就绪，直接输入即可检索。</p>
            <p className="mt-2">可以先试这些：</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['右半平面零点', 'ZVS', '峰值电流模式 斜坡补偿', 'DCM 断续模式', '环路增益 穿越频率', 'kalman'].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => onPick(s)}
                    className="px-2.5 py-1 rounded-md border border-border hover:border-primary text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {s}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {tab === 'text' && textResult && (
          <TextResults result={textResult} index={textIdx} terms={terms} />
        )}
        {tab === 'formula' && formulaResult && (
          <FormulaResults result={formulaResult} />
        )}
      </div>

      <footer className="mt-12 pt-6 border-t border-border text-xs text-text-muted leading-relaxed">
        <p>
          索引在建站时离线生成，随站点一起发布；浏览器内检索，查询不出本机。
          数据源为本站知识库 43 份资料（{textIdx ? textIdx.chunks.length.toLocaleString() : '—'} 个文本块、
          {formulaIdx ? formulaIdx.formulas.length.toLocaleString() : '20,596'} 条公式），
          与「建模与控制手册」同源。手册里逐条公式的出处以手册页为准，此处只负责定位到原文段落。
        </p>
        <p className="mt-2">
          返回 <Link to="/" className="text-primary-light hover:underline">首页</Link> ·
          需要按章节读，看 <Link to="/handbook" className="text-primary-light hover:underline">建模与控制手册</Link>
        </p>
      </footer>
    </div>
  )
}

function TextResults({
  result,
  index,
  terms,
}: {
  result: { hits: Hit<{ i: string; b: number; n: number; c: string }>[]; missing: string[] }
  index: TextIndex | null
  terms: string[]
}) {
  const { hits, missing } = result
  if (!hits.length) {
    // 三种「没结果」要分开说，否则会误导：
    //   a) 有词从头到尾没出现过 → 让用户换写法；
    //   b) 词都出现过，只是没有一段同时包含 → 让用户少给一个词；
    //   c) 两者都有 → 两条一起说。
    // 早先这里只写了「这些词一次都没出现」，可是「阿巴阿巴不存在的词」这种输入
    // 会被切出 3 个词，其中 2 个是有命中的，那句话就不准确了。
    const appeared = terms.filter((t) => !missing.includes(t))
    return (
      <div className="card-surface p-5 text-sm leading-relaxed text-text-secondary">
        <p className="text-text-primary font-semibold mb-2">没有命中</p>
        {missing.length > 0 && (
          <p>
            这几个词在 43 本书里一次都没出现：
            {missing.map((t) => (
              <code key={t} className="mx-1 font-mono text-xs px-1.5 py-0.5 rounded bg-surface-elevated">
                {t}
              </code>
            ))}
            。换成书里可能用的写法再试（中文术语在英文书里要换英文）。
          </p>
        )}
        {appeared.length > 0 && (
          <p className={missing.length > 0 ? 'mt-2' : ''}>
            {appeared.length === 1 ? '这个词单独能搜到，' : `另外 ${appeared.length} 个词单独都能搜到，`}
            但没有一段同时包含全部检索词。少给一个词通常会出结果。
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <p className="text-sm text-text-muted mb-3">
        命中 <span className="text-text-primary font-semibold">{hits.length}</span> 段
        {hits.length >= 200 && '（只显示前 200）'}
        {missing.length > 0 && (
          <span className="ml-2 text-danger">
            · 「{missing.join('」「')}」未命中，已在结果中忽略
          </span>
        )}
      </p>
      <div className="space-y-3">
        {hits.map((h) => {
          const book = index?.books[h.row.b]
          return (
            <article key={h.row.i} className="card-surface p-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
                <span className="text-sm font-semibold text-text-primary">{book?.t}</span>
                <span className="font-mono text-[11px] text-text-muted">
                  第 {h.row.n + 1} 块 · {h.row.i}
                </span>
              </div>
              {/* break-words 是必需的：OCR 出来的正文里夹着 LaTeX 与 URL 这类
                  无空格长串（如 \frac{1}{2\pi R{\text{ESR}}C{\text{out}}}），
                  pre-wrap 只在空格处断行，窄屏下会把卡片撑破（实测 375px 溢出 44px）。 */}
              <p className="search-snippet text-sm leading-relaxed text-text-secondary whitespace-pre-wrap break-words">
                <MathText text={h.snippet} ranges={h.ranges} />
              </p>
            </article>
          )
        })}
      </div>
    </>
  )
}

function FormulaResults({
  result,
}: {
  result: { hits: Hit<{ d: string; p: number; l: string; n?: string; x?: string }>[]; missing: string[] }
}) {
  const { hits, missing } = result
  if (!hits.length) {
    return (
      <div className="card-surface p-5 text-sm leading-relaxed text-text-secondary">
        <p className="text-text-primary font-semibold mb-2">没有命中</p>
        <p>
          公式这一路只比 LaTeX 原文与它周围 160 字的上下文。
          {missing.length > 0 && `这些词没出现：${missing.join('、')}。`}
          要找符号请直接写 LaTeX 片段（如 <code className="font-mono text-xs">\\omega_n</code>）。
        </p>
      </div>
    )
  }
  return (
    <>
      <p className="text-sm text-text-muted mb-3">
        命中 <span className="text-text-primary font-semibold">{hits.length}</span> 条公式
        {hits.length >= 200 && '（只显示前 200）'}
      </p>
      <div className="space-y-3">
        {hits.map((h, i) => (
          <article key={`${h.row.d}-${h.row.p}-${i}`} className="card-surface p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
              <span className="text-sm font-semibold text-text-primary">{h.row.d}</span>
              <span className="font-mono text-[11px] text-text-muted">
                p.{h.row.p}
                {h.row.n ? ` · 式 ${h.row.n}` : ''}
              </span>
            </div>
            <div className="mb-2">
              {/* 公式一律按块级渲染：这一页的公式多半是 \begin{align} / \tag 这类
                  只能在 display 模式下成立的写法，按行内渲染会大面积为空。
                  渲染不出来的（OCR 把 \frac 写成 frac 之类）由组件退回原样 <pre>。 */}
              <DisplayMath latex={h.row.l} />
            </div>
            {h.row.x && (
              <p className="search-snippet text-sm leading-relaxed text-text-secondary line-clamp-3 break-words">
                <MathText text={h.row.x} />
              </p>
            )}
          </article>
        ))}
      </div>
    </>
  )
}
