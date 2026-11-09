# 开关变换器 · 建模与控制 — 知识工程站

从书籍到可计算工具的开关变换器建模与控制知识工程站：**公式可溯源、工具可复核**。

正式站：<https://www.control-mode.power-knowledge.tech/>（裸名 301 归一到 www）
兜底站：GitHub Pages（`WisdomHuang2020/control-mode`）
站群入口：<https://power-knowledge.tech/>

## 技术栈

与站群其余 React 站一致：Vite 6 + React 19 + TypeScript 5.7 + Tailwind CSS 4 +
react-router-dom 7 + lucide-react + framer-motion + KaTeX（本地打包，无 CDN）。

| 路径 | 作用 |
|---|---|
| `src/pages/Home.tsx` | 首页：两个入口、原则、范围口径 |
| `src/pages/SToZ.tsx` | 培训页：从 S 变换到 Z 变换（7 节，逐条附原文坐标） |
| `src/pages/Tustin.tsx` | 工具页：Tustin / 预畸变计算器 |
| `src/lib/tustin-core.mjs` | **计算内核**，纯函数、零 DOM 依赖，可被 Node 单独 import |
| `src/components/BodeChart.tsx` | 幅相频响 Canvas 绘图（只绘制，不含数值逻辑） |
| `src/components/VersionBadge.tsx` | 版本号唯一显示点（页头 + 页脚） |
| `scripts/` | 计算内核复核、版本断言、四方一致性审计 |
| `.github/workflows/` | Pages 兜底 / Lighthouse 正式 / tag→Release |
| `deploy/` | nginx vhost 模板、手动部署脚本、服务器拉取式自动部署脚本 |

## 本地开发与门禁

```bash
npm install
npm run dev        # 本地预览
npm test           # 计算内核复核 + 版本号单一来源断言（CI 门禁）
npm run build      # tsc --noEmit && vite build
npm run audit      # 发版收尾：CHANGELOG ↔ package.json ↔ 远端 tag ↔ Release
```

`npm run audit` 三档退出码：`0` 四方一致、`1` 有缺口、`3` 未能完整审计（API 不可用/限流，不得当作发完）。
反向验证：`node scripts/assert-version.mjs --changelog /tmp/fake.md` 应报错并退出 1。

## 发版顺序

1. 改代码 + 改 `package.json` version + 在 `CHANGELOG.md` 顶部加同版本条目
2. `npm test && npm run build`
3. `git commit && git push origin main`
4. `GIT_COMMITTER_DATE="$(git show -s --format=%cI HEAD)" git tag -a vX.Y.Z -m '...' && git push origin vX.Y.Z`
5. tag 推送触发 `release.yml` 自动建 Release
6. `npm run audit` ← 收尾闸门，退出码非 0 不算发完

## 部署

| 要素 | 值 |
|---|---|
| 目标机 | `43.142.148.37`（root，端口 22） |
| web 根 | `/var/www/control-mode`（**等于 nginx `root`**），属主 `www-data` |
| 主服务域名 | `www.control-mode.power-knowledge.tech` |
| 301 归一 | `control-mode.power-knowledge.tech` → 主服务域名 |
| 证书 | 独立双名证书 `control-mode.power-knowledge.tech`（webroot HTTP-01） |
| 版本哨兵 | `/var/www/control-mode/.deployed-version`（三段式、不带 `v`） |
| commit 哨兵 | `/var/www/control-mode/.deployed-commit`（已部署的 commit SHA） |

### 当前生效通道：服务器拉取式自动部署（不需要 secrets）

`deploy/server-pull-deploy.sh` 安装为服务器上的 `/usr/local/bin/control-mode-deploy.sh`，
由 `/etc/cron.d/control-mode-deploy` 每 5 分钟触发一次：

1. `git ls-remote` 取 GitHub `main` 的 SHA，与线上 `.deployed-commit` 比对；
2. 一致且版本哨兵存在 → 静默退出（不写日志，避免每 5 分钟刷屏）；
3. 有变化 → `git reset --hard` → 依赖按 lock 哈希判断（未变则跳过 `npm ci`）→ `npm run build`；
4. **构建成功才发布**：`rsync --delete` 到 `/var/www/control-mode`，再写两个哨兵。

所以 `git push` 之后几分钟内自动上线，全程不需要 PAT、不需要 GitHub Actions secrets
（仓库是公开的，服务器走 HTTPS 匿名只读）。

| 项 | 路径 |
|---|---|
| 源码工作副本 | `/opt/control-mode-src` |
| 部署脚本 | `/usr/local/bin/control-mode-deploy.sh` |
| 定时任务 | `/etc/cron.d/control-mode-deploy` |
| 日志 / 轮转 | `/var/log/control-mode-deploy.log`、`/etc/logrotate.d/control-mode-deploy` |

手动执行：`/usr/local/bin/control-mode-deploy.sh`；停用：把 `/etc/cron.d/control-mode-deploy`
移出（脚本内 `flock` 保证与手动执行不会并发）。

> 它只写 `/opt/control-mode-src` 与 `/var/www/control-mode`，不碰 nginx 和其它站。
> 构建失败会直接退出，线上保持上一版，不会出现半成品。

### 备用通道：GitHub Actions（当前为假绿）

`.github/workflows/deploy-lighthouse.yml` 需要仓库 secrets：
`LH_HOST` / `LH_USER` / `LH_ROOT` / `LH_SSH_KEY` / `LH_PORT`（可选）。
**未配置时工作流优雅跳过但 job 仍显示绿勾（假绿）** —— 判断是否真的部署了，必须下钻到步骤级
看 `Deploy to server over SSH` 是 `success` 而不是 `skipped`。

应急手动上传或回滚可用 `deploy/deploy.sh`（用法见脚本头部注释）。

> 与拉取式通道**二选一**：两条同时启用会重复部署（内容相同、无数据风险，但白跑一次构建）。
> 当前线上由拉取式通道负责，本工作流保持 skipped 即可。

nginx vhost 模板见 `deploy/nginx-control-mode.conf`，线上生效文件为
`/etc/nginx/sites-available/control-mode`，两侧改动必须同步并跑 `nginx -t`。

### 两条通道各自构建

| 通道 | 构建命令 | base | 路由 |
|---|---|---|---|
| 正式域名 | `npm run build` | `/` | BrowserRouter，深链接刷新由 nginx 回退 |
| GitHub Pages | `npm run build -- --base /control-mode/` | `/control-mode/` | HashRouter |

不复用同一份 `dist`：相对 base 配 BrowserRouter 会把 `/learn/s-to-z` 刷新时的
`./assets/...` 解析到 `/learn/assets/...` 而 404。

> 本机 Git Bash 下验证 Pages 构建需加 `MSYS_NO_PATHCONV=1`，否则 `/control-mode/`
> 会被 MSYS 路径转换改写成 PortableGit 安装目录（Linux CI 无此问题）。

GitHub Pages 兜底通道默认不自动跑（`deploy.yml` 的 job 有 `vars.PAGES_ENABLED` 闸门，
未启用时 job 为 skipped 而非红灯）。要启用：仓库 Settings → Pages 选「GitHub Actions」，
设仓库变量 `PAGES_ENABLED=true`，再放开 `deploy.yml` 里的 `push.branches: [main]`。

## 三层线上核验

1. 状态码：主站 200、裸名 301 → www、隐藏文件 403、`/api/version/control-mode` 返回版本号
2. 产物指纹：线上 `index.html` 引用的 `assets/index-*.js` 与本次 `dist/` 一致
3. 渲染：无头浏览器打开页面，断言所有 `.app-version` 等于 `package.json` 版本、KaTeX 公式已渲染

## 口径

站内结论均标注书籍原文坐标；计算结果为理想模型值，不含量化、饱和、抗混叠滤波器与器件非线性。
覆盖度薄弱项与检索陷阱在培训页 §7 明确写出，不作填充。
