/**
 * playwright 加载器（几个浏览器脚本共用）。
 *
 * 两个坑记在这里，别再踩：
 *   ① playwright 装在全局 @playwright/cli 里，不在项目依赖内，版本目录随 node 版本变化，
 *      所以用 glob 找而不是写死路径；
 *   ② playwright 1.65 的 ESM 入口把 API 挂在 default 上，具名导出里没有 chromium，
 *      必须 `pwMod.chromium || pwMod.default?.chromium`。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

function findPlaywright() {
  const bases = [
    path.join(os.homedir(), '.workbuddy', 'binaries', 'node', 'versions'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules'),
    path.join(process.env.LOCALAPPDATA || '', 'npm-cache'),
  ]
  for (const base of bases) {
    if (!fs.existsSync(base)) continue
    const stack = [base]
    while (stack.length) {
      const dir = stack.pop()
      let entries
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const e of entries) {
        if (!e.isDirectory()) continue
        const p = path.join(dir, e.name)
        if (e.name === 'playwright' && fs.existsSync(path.join(p, 'index.js'))) return p
        if (dir.split(path.sep).length - base.split(path.sep).length < 6) stack.push(p)
      }
    }
  }
  return null
}

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

/** 返回 { chromium, executablePath }；找不到 playwright 时返回 null（调用方自行降级）。 */
export async function loadPlaywright() {
  const pwPath = findPlaywright()
  if (!pwPath) return null
  const pwMod = await import(pathToFileURL(path.join(pwPath, 'index.js')).href)
  const chromium = pwMod.chromium || pwMod.default?.chromium
  if (!chromium) return null
  return { chromium, executablePath: fs.existsSync(CHROME) ? CHROME : undefined }
}
