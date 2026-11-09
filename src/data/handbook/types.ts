/**
 * 「建模与控制手册」的内容模型。
 *
 * 为什么要数据驱动，而不是像 /learn/s-to-z 那样手写一个 .tsx：
 *   手册要覆盖知识库里的整条链路（12 章、从零基础到 MPC），手写组件会让
 *   「加一章」变成「写一个页面 + 复制一堆版式代码」。这里把内容压成数据，
 *   版式只有一套（Chapter.tsx），加章 = 加一个数据文件。
 *
 * 文本里支持两种极轻量的标记，够用且不需要 MDX：
 *   $...$      → 行内 KaTeX
 *   **...**    → 加粗
 */

export type Block =
  /** 段落 */
  | { t: 'p'; x: string }
  /** 小节标题 */
  | { t: 'h'; x: string }
  /** 独占一行的公式块 */
  | { t: 'f'; latex: string; note?: string }
  /** 要点列表 */
  | { t: 'list'; items: string[]; ordered?: boolean }
  /** 对照表：head 为表头，rows 每行长度需与表头一致 */
  | { t: 'table'; head: string[]; rows: string[][]; caption?: string }
  /** 提示块，kind 与 Callout 组件一致 */
  | { t: 'callout'; kind: 'key' | 'note' | 'ok' | 'warn'; x: string; title?: string }
  /** 工程口诀 / 经验值，单独一条 */
  | { t: 'rule'; x: string }

export type Source = {
  /** 书名，与知识库 source_file 保持一致，便于回查 */
  book: string
  /**
   * 书中位置：到节号即可，页码靠知识库检索回溯。
   * 纯文本出口（`《书名》+ where` 直接输出），**不要写 `$...$`**。
   */
  where: string
  /** 知识库里的块序号（可选，只标已核对过的） */
  chunk?: number
}

export type Chapter = {
  /** 全局序号，也就是「从简到难」的台阶号 */
  level: number
  /** 路由片段：/handbook/<slug> */
  slug: string
  /**
   * 纯文本，**不要写 `$...$` 或 `**...**`**。
   * 标题会出现在 h1、前置章节链接、上下阶导航三处，这三处都不走标记渲染，
   * 写了标记就会原样露出美元符号（v1.3.0→v1.4.0 踩过一次）。
   */
  title: string
  /** 一句话讲清这章在解决什么问题 */
  tagline: string
  /** 1 最浅、5 最难 */
  difficulty: 1 | 2 | 3 | 4 | 5
  /** 预计阅读分钟数 */
  minutes: number
  /** 所属阶段，用于地图分组。阶段必须连续编号，地图按区间显示「第 x–y 阶」。 */
  band: '入门' | '建模' | '控制' | '进阶' | '专题'
  /** 前置章节 slug，用于「先读这个」提示 */
  prereq: string[]
  /** 读完能做到的三件事 */
  goal: string[]
  blocks: Block[]
  /** 常见误区，每条一句话 */
  pitfalls: string[]
  /** 自测：答案默认折叠 */
  quiz: { q: string; a: string }[]
  /** 出处 */
  sources: Source[]
}

export const DIFFICULTY_LABEL: Record<number, string> = {
  1: '零基础可读',
  2: '需要初中数学',
  3: '需要微积分',
  4: '需要频域基础',
  5: '需要矩阵与状态空间',
}
