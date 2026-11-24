/* 无头核验探针（仅用于本地审计，不进交付产物）。
   用法：把本文件放进 dist/__probe_src/，并复制一份 index.html 为 __probe.html 注入 <script src="/__probe_src/probe_inject.js">。
   探针通过 history.pushState + popstate 在 SPA 内跳到目标路由，再测量真实 DOM 与真实画布像素。

   两处已踩过的坑（上一轮审核的教训，这里直接避开）：
   ① `#sources` / `#interface` / `#quiz` 是 <h2>，真正的列表在**兄弟节点**里，
      querySelector('#sources li') 恒为空 → 一条出处都没验到。必须用 nextElementSibling。
   ② 画布整块铺了不透明底色，用「alpha>20 的像素数」当判据会得到 coverage=1，
      什么也证明不了。必须先找**主色（背景）**，再统计与主色不同的像素。 */
(function () {
  var log = []
  function step(name, fn) {
    try {
      log.push({ name: name, ok: true, r: fn() })
    } catch (e) {
      log.push({ name: name, ok: false, err: String((e && e.message) || e) })
    }
  }
  function siblingList(anchorId, sel) {
    var h = document.getElementById(anchorId)
    if (!h || !h.nextElementSibling) return []
    return Array.prototype.map.call(h.nextElementSibling.querySelectorAll(sel), function (el) {
      return el.textContent
    })
  }
  function canvasStat(cv) {
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
    var n = cv.width * cv.height
    var hist = {}
    var i
    for (i = 0; i < n; i++) {
      var k = (d[i * 4] >> 4) + '_' + (d[i * 4 + 1] >> 4) + '_' + (d[i * 4 + 2] >> 4)
      hist[k] = (hist[k] || 0) + 1
    }
    var keys = Object.keys(hist).sort(function (a, b) { return hist[b] - hist[a] })
    var bg = keys[0]
    var drawn = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1
    for (i = 0; i < n; i++) {
      var k2 = (d[i * 4] >> 4) + '_' + (d[i * 4 + 1] >> 4) + '_' + (d[i * 4 + 2] >> 4)
      if (k2 !== bg) {
        drawn++
        var x = i % cv.width, y = (i / cv.width) | 0
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    return {
      attr: cv.width + 'x' + cv.height,
      dominant: bg,
      distinctColors: keys.length,
      drawnPixels: drawn,
      drawnRatio: +(drawn / n).toFixed(4),
      bbox: maxX > 0 ? (maxX - minX + 1) + 'x' + (maxY - minY + 1) : '0x0',
      topColors: keys.slice(0, 6).map(function (k) { return k + ':' + hist[k] }),
    }
  }

  var q = new URLSearchParams(location.search)
  var target = q.get('target') || '/math'
  history.pushState({}, '', target)
  window.dispatchEvent(new PopStateEvent('popstate'))

  setTimeout(function () {
    step('h1', function () {
      var h = document.querySelector('article h1, h1')
      return h ? h.textContent : null
    })
    step('katex-errors', function () { return document.querySelectorAll('.katex-error').length })
    step('katex-html', function () { return document.querySelectorAll('.katex').length })
    step('math-blocks', function () { return document.querySelectorAll('.math-block').length })
    step('figures', function () { return document.querySelectorAll('.prereq-figure img').length })
    step('videos', function () { return document.querySelectorAll('.prereq-figure video').length })
    step('demos', function () { return document.querySelectorAll('.prereq-demo canvas').length })
    step('canvas-stats', function () {
      var res = []
      var cvs = document.querySelectorAll('.prereq-demo canvas')
      for (var i = 0; i < cvs.length; i++) res.push(canvasStat(cvs[i]))
      return res
    })
    step('img-loaded', function () {
      var bad = []
      var imgs = document.querySelectorAll('.prereq-figure img')
      for (var i = 0; i < imgs.length; i++) {
        if (!imgs[i].complete || imgs[i].naturalWidth === 0) bad.push(imgs[i].getAttribute('src'))
      }
      return { total: imgs.length, broken: bad }
    })
    step('video-attrs', function () {
      var out = []
      var vs = document.querySelectorAll('.prereq-figure video')
      for (var i = 0; i < vs.length; i++) {
        out.push({
          src: vs[i].getAttribute('src'),
          poster: vs[i].getAttribute('poster'),
          readyState: vs[i].readyState,
          duration: vs[i].duration,
          err: vs[i].error ? vs[i].error.code : null,
        })
      }
      return out
    })
    step('sources', function () { return siblingList('sources', 'li') })
    step('interface-links', function () {
      var h = document.getElementById('interface')
      if (!h || !h.nextElementSibling) return []
      return Array.prototype.map.call(h.nextElementSibling.querySelectorAll('a'), function (a) {
        return a.getAttribute('href')
      })
    })
    step('quiz-count', function () { return siblingList('quiz', 'details').length })
    step('pitfall-count', function () { return siblingList('pitfalls', 'li').length })
    step('raw-dollar-leak', function () {
      var t = document.body.innerText || ''
      var m = t.match(/\$[^$\n]{1,90}\$/g)
      return m ? m.slice(0, 12) : []
    })
    step('raw-bold-leak', function () {
      var t = document.body.innerText || ''
      var m = t.match(/\*\*[^*\n]{1,90}\*\*/g)
      return m ? m.slice(0, 12) : []
    })
    step('h3-headings', function () {
      return Array.prototype.map.call(document.querySelectorAll('article h3'), function (h) {
        return h.textContent
      })
    })
    step('credits', function () {
      return Array.prototype.map.call(document.querySelectorAll('.prereq-fig-credit'), function (s) {
        return s.textContent.slice(0, 80)
      })
    })
    step('counts', function () {
      return {
        goals: document.querySelectorAll('article > div > ol li').length,
        prereqFigure: document.querySelectorAll('.prereq-figure').length,
        prereqDemo: document.querySelectorAll('.prereq-demo').length,
        callouts: document.querySelectorAll('.callout').length,
      }
    })
    step('overflow-x', function () {
      var de = document.documentElement
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, innerWidth: window.innerWidth }
    })
    step('nav-has-prereq', function () {
      var a = document.querySelector('header a[href="/math"]')
      return a ? a.textContent : null
    })
    var pre = document.createElement('pre')
    pre.id = '__probe'
    pre.textContent = JSON.stringify(log, null, 1)
    document.body.appendChild(pre)
  }, 2200)
})()
