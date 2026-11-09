# CHANGELOG

本文件是版本节点的权威清单。版本号单一来源为 `package.json`，
发版收尾必须跑 `npm run audit`（四方一致性审计），退出码非 0 不算发完。

## [v1.1.1] - 2026-11-09

修 1.1.0 在浅色主题下的两处「隐形」缺陷，并补齐图表与无障碍适配。

- **选中态与引文标签看不见**：`.chip.on` / `.callout.* .lbl` 原本是「`--color-primary-dark` 作底色 +
  `--color-primary-light` 作文字」。深色主题下这对变量是「深底 + 亮字」，浅色主题里却都被调成了深蓝
  （`#0050a0` 底 + `#0060b0` 字，实测对比度 ≈1.1:1）——工具页的选中档位、教学页的「结论/记法」标签
  全成了纯色块。改为 `primary` 的 16% 半透明涂层作底，8 套主题都用「浅底 + 深字」，
  实测对比度 5.78–9.25:1（原 1.1–3.8:1）。
- **amber 当文字用**：`.tag.s`、`.callout.warn` 用 `accent-light`（`#fbbf24`）压白底，约 1.6:1。
  浅色主题把 `accent`/`accent-light`/`success`/`danger` 各压深一档（`#b45309`/`#92400e`/`#15803d`/`#b91c1c`）。
- **次要文字**：浅色主题的 `--color-text-muted` 调深，对比度由 3.36–3.86 提到 4.5 以上。
- **s→z 映射图**：`SToZ.tsx` 里 34 处硬编码色（teal 轴线、`#a3a3a3` 刻度、`#134e4a` 阴影）改为
  `var(--color-*)`，浅色主题下不再出现深灰线画在白底上。
- **标签/阴影底色**：`rgba(…)` 全部换成 `color-mix(in srgb, var(--color-*) n%, transparent)`，跟随主题。
- **无障碍**：首页入场动画尊重系统「减少动态效果」（`useReducedMotion`），开启时直接呈现终态。

## [v1.1.0] - 2026-11-09

接入站群通用 8 套可切换主题，页眉补齐「风格」入口，与 LLC / AHB / motor-lighting 完全同构。内容与计算内核未变。

- **8 色主题**：新增 `dark-teal`（默认）/ `blue` / `navy-tech` / `graphite` / `warm-paper` / `forest` / `indigo` / `sea-salt` 八套变量，逐值取自 LLC 线上 CSS（与主入口双源核对）。契约与站群一致：`?theme=` 优先 → `localStorage['pk-theme']` → 默认 `dark-teal`；根元素 `data-theme` 驱动，`index.html` 内联脚本负责首屏防闪，`meta[name=theme-color]` 同步。
- **变量映射**：站群用 `--color-brand*`，本站沿用既有的 `--color-primary*`，八套主题做同名映射；`--color-accent`（amber 工程强调色）不随主题变化，保留原有辨识度。
- **顶栏「风格 ▾」**：新增 `ThemeSwitcher`，色点 + 「风格」+ 箭头，菜单位于最右、右对齐展开，含 8 项与当前选中标记；桌面置于「站群入口」右侧，移动端菜单底部同步提供一份，两处通过自定义事件保持选中态一致。支持 Esc 与点击外部关闭。
- **兼容**：主题只覆盖颜色变量，`katex` 公式、图表 SVG 与代码块在浅色主题下的对比度已逐套实拍核对；移动端菜单内的下拉不被裁剪。

## [v1.0.0] - 2026-11-09

首个公开发布版本。

- **技术栈对齐站群**：由零构建静态预览站重构为 Vite 6 + React 19 + TypeScript + Tailwind CSS 4 的 SPA，
  与 LLC / interleaved-pfc / AHB / optical / widget 同构；深色工程风主题（`#0a0a0a` / teal `#0f766e` / amber `#f59e0b`）。
- **内容完整迁移**：「从 S 变换到 Z 变换」7 节（含 6 张表、s→z 映射示意图、逐条原文出处与覆盖度说明）；
  Tustin / 预畸变计算器全部输入、读数、替换式、差分方程与幅相频响图。
- **计算可复核**：计算内核抽为独立模块 `src/lib/tustin-core.mjs`（纯函数、零 DOM 依赖），
  `scripts/test-tustin.mjs` 用 Node 单独复核 9 类数值关系，含「预畸变频率处幅相精确重合」的定义性质。
- **版本号单一来源**：`package.json` → `vite.config.ts` 的 `define(__APP_VERSION__)` → `VersionBadge` 组件；
  `scripts/assert-version.mjs` 断言全站零硬编码版本号、CHANGELOG 顶端一致、显示点统一。
- **双通道部署**：GitHub Pages 兜底（自动切 HashRouter）+ 腾讯轻量云正式域名
  `https://www.control-mode.power-knowledge.tech/`（BrowserRouter、SPA 回退）；
  `deploy-lighthouse.yml` 带版本哨兵与拒绝降级护栏，自检步骤只体检不当门禁。
- **证书与归一**：`www.control-mode.*` 为二级子域，通配符证书不覆盖，故 webroot(HTTP-01) 单独签发双名证书；
  裸名 `control-mode.power-knowledge.tech` 301 归一到 www。
- **合规**：页脚展示 ICP / 公安联网备案信息与免责声明，与站群其余站一致。
