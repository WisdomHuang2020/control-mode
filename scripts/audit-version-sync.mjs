/**
 * 发版收尾：四方一致性审计（CHANGELOG ↔ package.json ↔ 远端 tag ↔ GitHub Release）。
 *
 * 依据技能 git-semver-tag-release 一·五节，按 Vite 项目适配：
 * 单一来源用 package.json（技能 6.2），故此处读它而不是 js/version.js。
 * 远端 tag 一律以 `git ls-remote --tags origin` 为准，绝不用本地 tag 判断。
 *
 * 退出码三档（技能 7·8）：
 *   0 = 四方一致，可视为发完
 *   1 = 有缺口（列出缺什么）
 *   3 = 未能完整审计（API 不可用 / 限流），不得当作「发完了」
 *
 * 反向验证：--changelog <file> 可注入一个人为缺口，脚本必须报 ✘ 且退出 1。
 *
 * ⚠️ 不在脚本里调 `git credential fill`（本机 GCM 会挂住管道，技能 7·7）。
 *    需要写凭证时用环境变量 GITHUB_TOKEN / GH_TOKEN，取不到就匿名只读。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const ci = argv.indexOf('--changelog')
const changelog = fs.readFileSync(ci >= 0 ? argv[ci + 1] : path.join(root, 'CHANGELOG.md'), 'utf8')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const REPO = 'WisdomHuang2020/control-mode'

const semverCmp = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

const facts = []
const errors = []
const incomplete = []

// ① CHANGELOG：版本节点的权威清单
const expected = [...changelog.matchAll(/^## \[v(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}\s*$/gm)].map((m) => m[1])
facts.push(['CHANGELOG 条目', expected.length ? `${expected.length} 个，顶端 v${expected[0]}` : '（空）'])
if (!expected.length) errors.push('CHANGELOG 没有任何版本条目')

// ② 单一来源
const single = pkg.version
facts.push(['单一来源 package.json', `v${single}`])
if (expected[0] !== single) errors.push(`CHANGELOG 顶端 v${expected[0]} ≠ package.json v${single}`)

// ③ 远端 tag
let tags = []
try {
  const out = execFileSync('git', ['ls-remote', '--tags', 'origin'], {
    cwd: root, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  tags = [...out.matchAll(/refs\/tags\/(v\d+\.\d+\.\d+)(?:\^\{\})?$/gm)].map((m) => m[1])
  tags = [...new Set(tags)]
  facts.push(['远端 tag', tags.length ? `${tags.length} 个，顶端 v${[...tags].sort(semverCmp).at(-1)}` : '（空）'])
} catch (e) {
  incomplete.push(`远端 tag 读取失败：${e.message.split('\n')[0]}`)
  facts.push(['远端 tag', '（未能读取）'])
}

// ④ GitHub Releases（匿名可读；限流则标记「未能完整审计」）
let releases = []
try {
  const args = ['-sS', '--max-time', '15', '-H', 'Accept: application/vnd.github+json',
    `https://api.github.com/repos/${REPO}/releases?per_page=100`]
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) args.splice(1, 0, '-H', `Authorization: Bearer ${token}`)
  const out = execFileSync('curl', args, { encoding: 'utf8', timeout: 25000 })
  const data = JSON.parse(out)
  if (!Array.isArray(data)) {
    incomplete.push(`GitHub Releases 接口未返回列表：${typeof data === 'object' ? data.message : out.slice(0, 80)}`)
  } else {
    releases = data.map((r) => String(r.tag_name).replace(/^v/, ''))
    facts.push(['GitHub Release', releases.length ? `${releases.length} 个` : '（空）'])
  }
} catch (e) {
  incomplete.push(`GitHub Releases 读取失败：${e.message.split('\n')[0]}`)
}
if (releases.length === 0 && !incomplete.some((s) => s.includes('Releases'))) {
  facts.push(['GitHub Release', '（空）'])
}

// 集合一致（两个方向含义不同）
for (const v of expected) {
  if (tags.length && !tags.includes(v)) errors.push(`CHANGELOG 有 v${v} 但远端无 tag（漏推 tag）`)
  if (!incomplete.some((s) => s.includes('Releases')) && !releases.includes(v)) errors.push(`CHANGELOG 有 v${v} 但无 Release（tag 推送不会自动建 Release）`)
}
for (const v of tags) if (!expected.includes(v)) errors.push(`远端 tag v${v} 不在 CHANGELOG（漏写条目或误打标签）`)

// 顶端一致
const topTag = tags.length ? [...tags].sort(semverCmp).at(-1) : null
if (topTag && topTag !== single) errors.push(`顶端不一致：远端 tag v${topTag} ≠ package.json v${single}`)

console.log('四方一致性审计 ·', REPO)
for (const [k, v] of facts) console.log(`  ${k.padEnd(24)} ${v}`)
if (errors.length) for (const e of errors) console.log(`  ✘ ${e}`)
if (incomplete.length) for (const e of incomplete) console.log(`  ⚠ ${e}`)

if (incomplete.length) {
  console.log('结论：审计不完整（不能视为发完）')
  process.exit(3)
}
if (errors.length) {
  console.log(`结论：${errors.length} 处缺口，发版未完成`)
  process.exit(1)
}
console.log('结论：✔ 四方一致，发版完成')
