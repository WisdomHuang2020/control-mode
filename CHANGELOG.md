# CHANGELOG

本文件是版本节点的权威清单。版本号单一来源为 `package.json`，
发版收尾必须跑 `npm run audit`（四方一致性审计），退出码非 0 不算发完。

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
