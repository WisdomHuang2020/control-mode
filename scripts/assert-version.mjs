/**
 * 版本号单一来源断言（发版门禁）。
 *
 * Vite/React 项目按技能 6.2 的适配：单一来源 = package.json 的 version，
 * 经 vite.config.ts 的 define 注入 __APP_VERSION__，由 VersionBadge 组件渲染。
 * 页面里不得出现任何硬编码 vX.Y.Z —— 这是防漂移的核心断言。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const pkg = JSON.parse(read('package.json'))

// 1) 版本格式
assert.match(pkg.version, /^\d+\.\d+\.\d+$/, `package.json version 格式非法：${pkg.version}`)

// 2) CHANGELOG 顶部版本与单一来源一致；条目降序、有日期、无重复
const argv = process.argv.slice(2)
const ci = argv.indexOf('--changelog')
const changelog = ci >= 0 ? fs.readFileSync(argv[ci + 1], 'utf8') : read('CHANGELOG.md')
const entries = [...changelog.matchAll(/^## \[v(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$/gm)]
  .map((m) => ({ v: m[1], date: m[2] }))
assert.ok(entries.length > 0, 'CHANGELOG 无版本条目')
assert.equal(entries[0].v, pkg.version, `CHANGELOG 顶部 ${entries[0].v} ≠ package.json ${pkg.version}`)
assert.equal(new Set(entries.map((e) => e.v)).size, entries.length, 'CHANGELOG 存在重复版本')
for (let i = 1; i < entries.length; i++) {
  const a = entries[i - 1].v.split('.').map(Number)
  const b = entries[i].v.split('.').map(Number)
  const newer = a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))
  assert.ok(newer, `CHANGELOG 版本未降序：${entries[i - 1].v} → ${entries[i].v}`)
}

// 3) 构建注入链存在
const viteCfg = read('vite.config.ts')
assert.match(viteCfg, /__APP_VERSION__/, 'vite.config.ts 缺少 define(__APP_VERSION__)')
assert.match(viteCfg, /JSON\.stringify\(pkg\.version\)/, 'define 必须以 package.json 为源')
assert.match(read('src/vite-env.d.ts'), /declare const __APP_VERSION__: string/, '缺少类型声明')

// 4) 版本显示点：唯一组件 + class 钩子
const badge = read('src/components/VersionBadge.tsx')
assert.match(badge, /className=\{`app-version/, 'VersionBadge 缺少 .app-version 钩子')
assert.match(badge, /__APP_VERSION__/, 'VersionBadge 未引用构建期常量')
assert.match(badge, /v\{APP_VERSION\}/, 'VersionBadge 未渲染版本号')

// 5) 防回归核心：index.html 与 src/ 下不得出现硬编码版本号
const hardcode = /\bv\d+\.\d+\.\d+\b/
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) return walk(rel)
    return /\.(tsx?|jsx?|html|css|mjs)$/.test(e.name) ? [rel] : []
  })
}
const checked = ['index.html', ...walk('src')]
for (const f of checked) {
  const text = read(f)
  assert.ok(!hardcode.test(text), `${f} 含硬编码版本号，应改用 VersionBadge`)
}

// 6) 所有显示点都走同一个组件（Header / Footer 不得自行拼版本号）
for (const f of ['src/components/Header.tsx', 'src/components/Footer.tsx']) {
  assert.match(read(f), /VersionBadge/, `${f} 未使用 VersionBadge`)
  assert.ok(!hardcode.test(read(f)), `${f} 含硬编码版本号`)
}

console.log(`版本断言通过：单一来源 v${pkg.version}，检查 ${checked.length} 个源文件，0 处硬编码，显示点统一走 VersionBadge`)
