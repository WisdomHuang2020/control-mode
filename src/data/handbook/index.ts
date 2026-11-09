import type { Chapter } from './types'
import { PART1 } from './part1'
import { PART2 } from './part2'
import { PART3 } from './part3'
import { PART4 } from './part4'
import { PART5 } from './part5'

export * from './types'

/** 全部章节，顺序即「从简到难」的台阶顺序。 */
export const CHAPTERS: Chapter[] = [...PART1, ...PART2, ...PART3, ...PART4, ...PART5]

export const BAND_ORDER: Chapter['band'][] = ['入门', '建模', '控制', '进阶', '专题']

export const BAND_DESC: Record<Chapter['band'], string> = {
  入门: '不需要微积分。先把电路在干什么、数学要描述什么对齐。',
  建模: '三步法 → 状态空间 → 等效电路 → 传递函数，一条链走完。',
  控制: '判断稳不稳、把它做稳，以及两种工程手段：电流模式与仿真。',
  进阶: '把控制器搬进芯片，以及频域方法撑不住的场合。',
  专题: '把前 12 阶一笔带过、工程上却一定会撞到的地方单独讲透：根轨迹、灵敏度、闭环三件套、模型边界、饱和、前馈。不按难度排序，按需要挑。',
}

export function chapterBySlug(slug: string | undefined): Chapter | undefined {
  if (!slug) return undefined
  return CHAPTERS.find((c) => c.slug === slug)
}

export function chapterNeighbors(slug: string) {
  const i = CHAPTERS.findIndex((c) => c.slug === slug)
  return {
    prev: i > 0 ? CHAPTERS[i - 1] : undefined,
    next: i >= 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i + 1] : undefined,
  }
}

/** 首页/地图用的规模统计，避免手写数字与内容脱节。 */
export const HANDBOOK_STATS = (() => {
  let formulas = 0
  let tables = 0
  let minutes = 0
  for (const c of CHAPTERS) {
    minutes += c.minutes
    for (const b of c.blocks) {
      if (b.t === 'f') formulas++
      if (b.t === 'table') tables++
    }
  }
  return { chapters: CHAPTERS.length, formulas, tables, minutes }
})()
