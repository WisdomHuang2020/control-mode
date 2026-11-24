/**
 * 全库检索页的无头探针。由 audit-search-dom.mjs 注入到 dist/__probe_search.html。
 *
 * 为什么要「轮询等结果」而不是定一个固定延时：
 *   检索页要先下载 6.85 MB（gzip）索引、parse、再等 250 ms 输入防抖，才开始检索。
 *   固定延时在快机器上浪费、在慢机器上误判。这里改成轮询直到出现结果或超时，
 *   判据是「结果区出现 <article>」或「出现『没有命中』」——两者都说明检索确实跑完了。
 */
;(function () {
  const ROUTE = new URLSearchParams(location.search).get('target') || '/search'
  // 用「轮询次数」而不是 Date.now() 当上限：headless 的虚拟时钟推进远快于真实计算，
  // 按时间判超时会在大索引还没 parse 完时就下结论，误报成「未就绪」。
  const MAX_TICKS = 600
  let ticks = 0

  // 在 SPA 内跳路由。必须手动派发 popstate —— pushState 本身不会通知 React Router，
  // 只改 URL 的话页面还停在首页，探针就会对着首页测「检索结果」，得出满屏 0。
  history.pushState({}, '', ROUTE)
  window.dispatchEvent(new PopStateEvent('popstate'))

  function dump(payload) {
    const pre = document.createElement('pre')
    pre.id = '__probe'
    pre.textContent = JSON.stringify(payload)
    document.body.appendChild(pre)
  }

  function busy() {
    const t = document.body.innerText || ''
    // 加载态文案（见 Search.tsx）：这两种都在说「还没就绪」
    return t.includes('正在载入') || t.includes('正在建立内存索引')
  }

  function collect() {
    const marks = document.querySelectorAll('mark')
    const articles = document.querySelectorAll('article')
    const notFound = (document.body.innerText || '').includes('没有命中')

    // 「切出 N 个检索词」那行 —— 验证分词在真实页面里也生效
    const bodyText = document.body.innerText || ''
    const termLine = (bodyText.match(/切出\s*(\d+)\s*个检索词/) || [])[1] || null
    const msLine = (bodyText.match(/([\d.]+)\s*ms/) || [])[1] || null
    const hitLine = (bodyText.match(/命中\s*(\d+)\s*(段|条)/) || [])[1] || null
    const missingLine = (bodyText.match(/「([^」]+)」未命中/) || [])[1] || null

    return {
      route: ROUTE,
      h1: (document.querySelector('h1') || {}).textContent || null,
      articles: articles.length,
      marks: marks.length,
      /** 高亮文本样本，确认 mark 包的是命中词而不是别的东西 */
      markSamples: [...marks].slice(0, 5).map((m) => m.textContent),
      notFound,
      ready: !busy(),
      terms: termLine,
      ms: msLine,
      hitsReported: hitLine,
      missingTerm: missingLine,
      /** 页面上那句「字面检索不是语义问答」的诚实声明是否存在 */
      honestNote: bodyText.includes('这是字面检索，不是语义问答'),
      loadingText: busy(),
      /** 横向溢出检查 */
      overflowX: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      navHasSearch: bodyText.includes('检索'),
      /** 诊断用：把「正在载入 / 正在建立内存索引」附近的文案截出来 */
      stageText: (bodyText.match(/正在[^\n]{0,60}/) || [])[0] || null,
      tickCount: ticks,
    }
  }

  function tick() {
    ticks++
    const a = document.querySelectorAll('article')
    const t = document.body.innerText || ''
    const done = a.length > 0 || t.includes('没有命中')
    if (done || ticks >= MAX_TICKS) {
      dump(collect())
      return
    }
    setTimeout(tick, 200)
  }

  // 等 React 挂载完成再开始轮询
  setTimeout(tick, 500)
})()
