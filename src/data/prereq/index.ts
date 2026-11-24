import type { PrereqChapter } from './types'
import { PART1 } from './part1'
import { PART2 } from './part2'

export * from './types'

/**
 * 全部前置知识章节，顺序即「先数学、后控制」的依赖顺序。
 *
 * 第 1–6 章（PART1）来自两本外部数学教材，每条结论都能回到节号与式号；
 * 第 7 章（PART2）是变换全景，坐标变换与进阶工具部分来自一份外部工程速查稿，
 * 出处性质不同（见 BOOK_TUTORIAL / TUTORIAL_NOTE），不要合并成一个数组字面量。
 */
export const PREREQ_CHAPTERS: PrereqChapter[] = [...PART1, ...PART2]

export function prereqBySlug(slug: string | undefined): PrereqChapter | undefined {
  if (!slug) return undefined
  return PREREQ_CHAPTERS.find((c) => c.slug === slug)
}

export function prereqNeighbors(slug: string) {
  const i = PREREQ_CHAPTERS.findIndex((c) => c.slug === slug)
  return {
    prev: i > 0 ? PREREQ_CHAPTERS[i - 1] : undefined,
    next: i >= 0 && i < PREREQ_CHAPTERS.length - 1 ? PREREQ_CHAPTERS[i + 1] : undefined,
  }
}

/**
 * 规模统计，全部从内容里算出来，避免手写数字与正文脱节。
 *
 * 注意口径：这些数字**只统计本模块自己的内容**，
 * 不能和首页那套「43 份资料 / 17,292 块 / 20,596 条公式」相加——
 * 两本书是外部资料，未入知识库。
 */
export const PREREQ_STATS = (() => {
  let formulas = 0
  let figures = 0
  let videos = 0
  let demos = 0
  let tables = 0
  let minutes = 0
  let sources = 0
  const books = new Set<string>()
  for (const c of PREREQ_CHAPTERS) {
    minutes += c.minutes
    sources += c.sources.length
    for (const b of c.blocks) {
      if (b.t === 'f') formulas++
      if (b.t === 'table') tables++
      if (b.t === 'figure') figures++
      if (b.t === 'video') videos++
      if (b.t === 'demo') demos++
    }
    for (const s of c.sources) books.add(s.book)
  }
  return {
    chapters: PREREQ_CHAPTERS.length,
    formulas,
    figures,
    videos,
    demos,
    tables,
    minutes,
    sources,
    books: books.size,
  }
})()
