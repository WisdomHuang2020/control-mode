/**
 * 「前置知识」模块的内容模型。
 *
 * 为什么单独建一套类型，而不是复用 handbook/types.ts：
 *   这一模块的素材来自两本**外部**数学教材（未入本站知识库），内容形态也不同——
 *   它要装书内插图、预渲染视频和交互式动态组件。复用手册的 Block 会把
 *   「书内原图」和「本站自制素材」混进同一个类型里，出处就分不清了。
 *
 * 纯文本出口纪律（与手册一致，已踩坑 5 次）：
 *   title / tagline / where 一律**不写 `$` 或 `**`**。
 *   这三个字段会被原样输出到 h1、目录、导航链接和出处列表，不走标记渲染。
 *   caption / credit 走 RichText，可以写行内公式。
 */

export type DemoKind =
  | 'complex-mapping'
  | 'fourier-series'
  | 'laplace-poles'
  | 'z-mapping'
  | 'state-space'
  | 'law-of-large-numbers'

export type PrereqBlock =
  /** 段落（走 RichText，可写行内公式与加粗） */
  | { t: 'p'; x: string }
  /** 小节标题 */
  | { t: 'h'; x: string }
  /** 独占一行的公式块 */
  | { t: 'f'; latex: string; note?: string }
  /** 要点列表 */
  | { t: 'list'; items: string[]; ordered?: boolean }
  /** 对照表 */
  | { t: 'table'; head: string[]; rows: string[][]; caption?: string }
  /** 提示块 */
  | { t: 'callout'; kind: 'key' | 'note' | 'ok' | 'warn'; x: string; title?: string }
  /** 工程口诀 / 经验值 */
  | { t: 'rule'; x: string }
  /** 书内原图（figure） */
  | { t: 'figure'; src: string; caption: string; credit: string }
  /** 本站预渲染的教学视频（video） */
  | { t: 'video'; src: string; poster: string; caption: string; credit: string }
  /** 页面内交互式动态组件（demo） */
  | { t: 'demo'; kind: DemoKind; caption: string }

/**
 * 出处。
 *
 * `book` 与 `where` 都是纯文本，**不要写 `$...$`**。
 *
 * 这两本书是**外部资料，未入本站知识库**，所以这里给到节号与式号，
 * 而不是「靠知识库检索回溯页码」——外部书的页码只有本地 OCR 才知道，
 * 而式号（(5-1)、(6-26)、定义 3.4.1）本身就是最精确、最易核对的坐标。
 */
export type PrereqSource = {
  book: string
  where: string
}

export type PrereqChapter = {
  /** 全局序号，1 起 */
  order: number
  /** 路由片段：/math/<slug> */
  slug: string
  /** 纯文本，**不要写 `$` 或 `**`** */
  title: string
  /** 一句话讲清这章在解决什么问题 */
  tagline: string
  /** 用到的数学工具名，例如「复分析」 */
  tool: string
  /** 预计阅读分钟数 */
  minutes: number
  /** 前置章节 slug */
  prereq: string[]
  /** 读完能做到的三件事 */
  goal: string[]
  blocks: PrereqBlock[]
  /** 常见误区 */
  pitfalls: string[]
  /** 自测，答案默认折叠 */
  quiz: { q: string; a: string }[]
  /**
   * 与手册的接口：这一步学完，手册里哪几阶可以直接用上。
   * `slug` 是手册里的真实章节 slug（拼成 /handbook/<slug>）；
   * 指向本站其它页面时改用 `href`。`note` 是纯文本。
   */
  links: { slug?: string; href?: string; note: string }[]
  /** 出处 */
  sources: PrereqSource[]
}

/** 两本书的正式书名，全站统一用这两个字符串，不要改写。 */
export const BOOK_CMATH = '控制工程数学基础（第2版）'
export const BOOK_MODERN = '系统与控制中的近代数学基础（第2版）'

/** 外部资料的统一声明，出处块里必须带这句。 */
export const EXTERNAL_NOTE =
  '这两本书是外部参考资料，未入本站知识库。页码不写死：坐标给到节号与式号，可直接翻书核对。'
