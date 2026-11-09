import { Link } from 'react-router-dom'
import MathBlock from '../components/MathBlock'
import InlineMath from '../components/InlineMath'
import Callout from '../components/Callout'

const M = InlineMath

const TOC = [
  ['s0', '00', '结论'],
  ['s1', '01', '桥梁：z = e^sT'],
  ['s2', '02', '几何映射'],
  ['s3', '03', '运算规则搬家'],
  ['s4', '04', '四种离散化替身'],
  ['s5', '05', '要付的代价'],
  ['s6', '06', '落地开关变换器'],
  ['s7', '07', '覆盖度说明'],
]

/** s 平面 → z 平面的指数映射示意。配色走 CSS 变量（随 8 套主题切换），几何与标签与原静态站一致。 */
function MappingFigure() {
  return (
    <figure className="my-6">
      <div className="card-surface p-4 overflow-x-auto">
        <svg viewBox="0 0 760 262" className="w-full min-w-[640px]" role="img" aria-label="s 平面到 z 平面的指数映射示意">
          <defs>
            <marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <path d="M0,0 L9,4.5 L0,9 z" fill="var(--color-primary-light)" />
            </marker>
          </defs>

          {/* s 平面 */}
          <rect x="30" y="30" width="230" height="200" fill="none" stroke="var(--color-border)" />
          <rect x="30" y="30" width="115" height="200" fill="var(--color-primary-dark)" opacity="0.55" />
          <line x1="30" y1="130" x2="260" y2="130" stroke="var(--color-text-muted)" strokeWidth="1" />
          <line x1="145" y1="30" x2="145" y2="230" stroke="var(--color-text-muted)" strokeWidth="1" />
          <text x="252" y="146" fontSize="12" fill="var(--color-text-secondary)" fontFamily="Georgia,serif" fontStyle="italic">σ</text>
          <text x="151" y="44" fontSize="12" fill="var(--color-text-secondary)" fontFamily="Georgia,serif" fontStyle="italic">jω</text>
          <text x="40" y="48" fontSize="12" fill="var(--color-text-muted)">s 平面</text>
          <text x="46" y="216" fontSize="11" fill="var(--color-primary-light)">稳定域</text>

          <circle cx="100" cy="82" r="5" fill="var(--color-primary-light)" />
          <circle cx="112" cy="176" r="5" fill="var(--color-primary-light)" />
          <circle cx="200" cy="92" r="5" fill="var(--color-danger)" />
          <line x1="100" y1="82" x2="112" y2="176" stroke="var(--color-primary-light)" strokeWidth="1" strokeDasharray="3,3" opacity=".5" />
          <text x="70" y="76" fontSize="10.5" fill="var(--color-primary-light)" fontFamily="monospace">s₁</text>
          <text x="120" y="190" fontSize="10.5" fill="var(--color-primary-light)" fontFamily="monospace">s₁*</text>
          <text x="208" y="86" fontSize="10.5" fill="var(--color-danger)" fontFamily="monospace">s₂</text>

          {/* 映射箭头 */}
          <line x1="288" y1="130" x2="352" y2="130" stroke="var(--color-primary-light)" strokeWidth="1.6" markerEnd="url(#ar)" />
          <text x="320" y="108" fontSize="15" fill="var(--color-primary-light)" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic">
            z = e<tspan fontSize="10" dy="-6">sT</tspan>
          </text>
          <text x="320" y="154" fontSize="10.5" fill="var(--color-text-secondary)" textAnchor="middle">采样周期 T</text>

          {/* z 平面 */}
          <rect x="390" y="30" width="230" height="200" fill="none" stroke="var(--color-border)" />
          <circle cx="505" cy="130" r="75" fill="var(--color-primary-dark)" opacity="0.55" />
          <circle cx="505" cy="130" r="75" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.2" />
          <line x1="390" y1="130" x2="620" y2="130" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="505" y1="30" x2="505" y2="230" stroke="var(--color-border)" strokeWidth="1" />
          <text x="612" y="146" fontSize="12" fill="var(--color-text-secondary)" fontFamily="Georgia,serif" fontStyle="italic">Re</text>
          <text x="511" y="44" fontSize="12" fill="var(--color-text-secondary)" fontFamily="Georgia,serif" fontStyle="italic">Im</text>
          <text x="400" y="48" fontSize="12" fill="var(--color-text-muted)">z 平面</text>
          <text x="530" y="72" fontSize="10.5" fill="var(--color-text-secondary)" fontFamily="monospace">|z| = 1</text>

          <circle cx="462" cy="88" r="5" fill="var(--color-primary-light)" />
          <circle cx="472" cy="172" r="5" fill="var(--color-primary-light)" />
          <circle cx="590" cy="98" r="5" fill="var(--color-danger)" />
          <text x="470" y="82" fontSize="10.5" fill="var(--color-primary-light)" fontFamily="monospace">z₁</text>
          <text x="480" y="186" fontSize="10.5" fill="var(--color-primary-light)" fontFamily="monospace">z₁*</text>
          <text x="598" y="92" fontSize="10.5" fill="var(--color-danger)" fontFamily="monospace">z₂</text>
        </svg>
      </div>
      <figcaption className="text-sm text-text-muted mt-3 leading-relaxed">
        左半平面的极点被映射到单位圆内，右半平面的极点落到圆外。注意这是<b className="text-text-primary">多对一</b>映射：
        s 平面沿虚轴每 <M latex="2\pi/T" /> 重复一次，全部折进同一个 z 平面。
      </figcaption>
    </figure>
  )
}

export default function SToZ() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-10">
        <aside className="toc hidden lg:flex">
          <div className="toc-t">本页目录</div>
          {TOC.map(([id, n, label]) => (
            <a key={id} href={`#${id}`}><span className="n">{n}</span>{label}</a>
          ))}
        </aside>

        <article className="article flex-1 min-w-0">
          <h1>从 S 变换到 Z 变换</h1>
          <p className="sub">采样是如何把一个连续时间理论，延伸成离散时间理论的。</p>

          <Callout type="key" id="s0">
            <p>
              Z 变换<b>不是一套新理论</b>，而是拉普拉斯变换在采样信号上的代数整理。两者由同一个复频域关系{' '}
              <M latex="\;z=e^{sT}\;" /> 连接——Z 变换就是把 s 平面按 <M latex="e^{sT}" /> 折叠进 z 平面后的结果。
              所有工程上的「离散化方法」，都是给这个超越关系找一个可计算的代数替身。
            </p>
          </Callout>

          {/* §1 ─────────────────────────────────────────────────────────── */}
          <h2 id="s1"><span className="sec">§1</span>桥梁：为什么会出现 z = e<sup>sT</sup></h2>
          <p>
            理想采样把连续信号 <M latex="e(t)" /> 变成一串冲激{' '}
            <M latex="e^*(t)=\sum_n e(nT)\,\delta(t-nT)" />。对它取拉普拉斯变换，得到一串指数项：
          </p>
          <MathBlock latex="E^*(s)=\sum_{n=0}^{\infty} e(nT)\,e^{-nTs}" />
          <p>
            问题就出在这里：<M latex="e^{-Ts}" /> 是 <M latex="s" /> 的<b>超越函数</b>，不是有理式，无法用多项式工具处理。
            卢京潮的原文把这个动机说得很直白：
          </p>
          <blockquote>
            <p>上式中的 <M latex="e^{-Ts}" /> 是 <i>s</i> 的超越函数，直接运算不方便，为此引入变量 …… 式中 <i>T</i> 为采样周期。</p>
            <p className="source">——《自动控制原理（卢京潮）》p.247，式(6-16)</p>
          </blockquote>
          <p>于是令</p>
          <MathBlock latex="z=e^{sT}\qquad\Longrightarrow\qquad E(z)=\sum_{n=0}^{\infty}e(nT)\,z^{-n}" />
          <p>那串指数项立刻收敛成 <M latex="z" /> 的幂级数。<b>这就是 z 变换的全部起源</b>——一个为了让式子能算而做的变量替换。</p>
          <Callout type="note">
            <p>
              <M latex="z^{-1}" /> 的物理意义只有一个：<b>延迟一个采样周期 T</b>。
              所以 <M latex="z^{-1}" /> 在离散域的地位，等同于 <M latex="e^{-sT}" /> 在连续域的地位。
            </p>
          </Callout>

          {/* §2 ─────────────────────────────────────────────────────────── */}
          <h2 id="s2"><span className="sec">§2</span>几何映射：s 平面如何折叠进单位圆</h2>
          <p>把 <M latex="s=\sigma+j\omega" /> 代进定义式：</p>
          <MathBlock latex="z=e^{(\sigma+j\omega)T}=e^{\sigma T}\cdot e^{j\omega T}\qquad\Longrightarrow\qquad |z|=e^{\sigma T},\quad \angle z=\omega T" />
          <p>两条式子直接决定了一切：<b>实部 σ 控制半径，虚部 ω 控制角度</b>。于是有那张必背的对应表：</p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>s 平面</th><th>z 平面</th><th>时域含义</th><th>稳定性</th></tr></thead>
              <tbody>
                <tr><td>虚轴 <M latex="\sigma=0" /></td><td><M latex="|z|=1" /> 单位圆</td><td>等幅振荡</td><td>临界</td></tr>
                <tr><td>左半平面 <M latex="\sigma\lt 0" /></td><td><M latex="|z|\lt 1" /> 圆内</td><td>衰减</td><td><b>稳定</b></td></tr>
                <tr><td>右半平面 <M latex="\sigma\gt 0" /></td><td><M latex="|z|\gt 1" /> 圆外</td><td>发散</td><td>不稳定</td></tr>
              </tbody>
            </table>
          </div>
          <MappingFigure />
          <p>
            稳定性判据因此原样搬过去：<b>闭环脉冲传递函数的所有极点必须位于单位圆内</b>。
            只要有一个在圆外就不稳定；落在圆上属临界（实为不稳定）。
          </p>
          <Callout type="warn">
            <p>
              这个映射<b>不是双射</b>。s 平面沿 <M latex="j\omega" /> 方向以采样角频率{' '}
              <M latex="\omega_s=2\pi/T" /> 为周期重复，整条条带都折进同一个单位圆。
              所以「高于 <M latex="\omega_s/2" /> 的分量」和「低频分量」会叠在同一处——
              <b>这就是混叠的几何来源</b>，不是另一个独立现象。
            </p>
          </Callout>

          {/* §3 ─────────────────────────────────────────────────────────── */}
          <h2 id="s3"><span className="sec">§3</span>运算规则搬家</h2>
          <p>变量替换一旦成立，整套运算规则就跟着搬过去：</p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>连续域（s）</th><th>离散域（z）</th><th>备注</th></tr></thead>
              <tbody>
                <tr><td>微分 <M latex="\dfrac{d}{dt}" /></td><td>差分 / 后移算子 <M latex="z^{-1}" /></td><td>差分方程是微分方程的离散形式</td></tr>
                <tr><td>纯延迟 <M latex="T" /></td><td>乘 <M latex="z^{-1}" /></td><td><M latex="e^{-sT}\to z^{-1}" /></td></tr>
                <tr><td>卷积</td><td>乘法 <M latex="Y(z)=G(z)X(z)" /></td><td>与拉氏变换同构</td></tr>
                <tr><td>极点位置定阻尼</td><td>极点位置定 <M latex="Q" /> / 振铃</td><td>极点越靠近原点，振荡越快衰减</td></tr>
              </tbody>
            </table>
          </div>
          <p>有意思的是，<b>开关变换器本身就自带离散性</b>，这不是我们强加的。张卫平在讨论 PWM 时直接把它建模成「采样开关 + 零阶保持器」：</p>
          <blockquote>
            <p>
              这种处理的实际意义相当于用一个单位冲击序列在 <M latex="t=nT" /> 时对 <M latex="u_c(t)" /> 信号进行采样和保持。
              所以，在图 4-2(b) 中，用一个采样开关 <M latex="\delta_T" /> 和零阶保持器 <M latex="G_{bo}(s)" /> 表示这个过程。
            </p>
            <p className="source">——《开关变换器的建模与控制（张卫平）》4.1 节</p>
          </blockquote>
          <p>由此得到 PWM 的离散数学模型：</p>
          <MathBlock latex="d(nT)=\frac{u_c(nT)}{V_M}\quad\Longrightarrow\quad D(z)=\frac{U_c(z)}{V_M}" />
          <p>
            他在 3.1.1 节说得更直接：脉宽调制器「<b>是一种模数变换器</b>」，
            所以开关调节系统「是一个高阶—离散—非线性、时变的病态控制系统」。
          </p>

          {/* §4 ─────────────────────────────────────────────────────────── */}
          <h2 id="s4"><span className="sec">§4</span>四种可计算的离散化替身</h2>
          <p>
            理想做法本该是 <M latex="s=\frac{1}{T}\ln z" /> 直接代入，但 <M latex="\ln z" /> 一样算不了。
            于是有了下面四种近似——它们在《自动控制原理（卢京潮）》6.8 节<b>同一页</b>并列出现。
          </p>

          <h3>① 后向差分（一阶差分近似）</h3>
          <MathBlock latex="s=\frac{1-z^{-1}}{T}\qquad\Longrightarrow\qquad D(z)=D(s)\Big|_{s=\frac{1-z^{-1}}{T}}" />
          <p>
            例：<M latex="D(s)=\dfrac{a}{s+a}\Rightarrow D_1(z)=\dfrac{aT}{1+aT-z^{-1}}=\dfrac{aTz}{(1+aT)z-1}" />。
            最简单，但只在低频贴近真值。
          </p>

          <h3>② 阶跃响应不变法（虚拟零阶保持器）</h3>
          <MathBlock latex="D(z)=\mathcal{Z}\!\left[\frac{1-\mathrm{e}^{-Ts}}{s}\,D(s)\right]" />
          <p>
            原文：「将模拟校正装置传递函数 <M latex="D(s)" /> 前端串联一个虚拟的零阶保持器，然后再进行 z 变换」。
            它的性质是<b>保证数字装置的阶跃响应序列等于模拟装置阶跃响应的采样值</b>。
          </p>
          <p>零阶保持器本身的传递函数：<M latex="\;G_h(s)=\dfrac{1-\mathrm{e}^{-Ts}}{s}\;" />。</p>

          <h3>③ 根匹配法</h3>
          <MathBlock latex="(s+a)\to\left(1-\mathrm{e}^{-aT}z^{-1}\right)" />
          <MathBlock latex="(s+a\pm jb)\to\left(1-2\mathrm{e}^{-aT}z^{-1}\cos bT+\mathrm{e}^{-2aT}z^{-2}\right)" />
          <p>
            增益由附加条件（如终值相等）确定；当极点比零点多 <M latex="n-m" /> 个时，
            在 z 平面补 <M latex="n-m" /> 个 <M latex="z=0" /> 的零点（对应 <M latex="s\to-\infty" />）。
            <b>这是唯一直接把 <M latex="e^{sT}" /> 逐点用上去的方法。</b>
          </p>

          <h3>④ 双线性变换（Tustin）——最常用</h3>
          <p>推导路径是<b>对 <M latex="\ln z" /> 做级数展开取一次近似</b>：</p>
          <MathBlock latex="\ln z=2\left[\frac{z-1}{z+1}+\frac{1}{3}\!\left(\frac{z-1}{z+1}\right)^{3}\!+\cdots\right]\;\Rightarrow\; s=\frac{2}{T}\frac{z-1}{z+1}=\frac{2}{T}\frac{1-z^{-1}}{1+z^{-1}}" />
          <p>同一条式子，不同教材从<b>不同路径</b>得到——这本身就是最好的交叉验证：</p>
          <div className="overflow-x-auto">
            <table className="data-table small">
              <thead><tr><th>来源</th><th>推导路径</th><th>结果</th></tr></thead>
              <tbody>
                <tr><td>卢京潮 p.279 (6-77)</td><td><M latex="\ln z" /> 级数一次近似</td><td><M latex="s=\frac{2}{T}\frac{z-1}{z+1}" /></td></tr>
                <tr><td>Franklin p.136</td><td>梯形积分</td><td>同左，原文注「这就是 Tustin」</td></tr>
                <tr><td>Erickson §19.2.3 (19.35)</td><td>离散积分器 δ 变换</td><td>同左，并给逆映射</td></tr>
              </tbody>
            </table>
          </div>
          <p>Erickson 还给出了逆映射，用来判断极点落点：</p>
          <MathBlock latex="z=\frac{1+\dfrac{sT_s}{2}}{1-\dfrac{sT_s}{2}}" />
          <p>
            由此可得：<M latex="s=0\to z=+1" />；<b>整个 s 左半平面映射到单位圆内部</b>；
            虚轴映射到单位圆上；负实轴映射到 <M latex="(+1,-1)" /> 之间的实轴。
          </p>

          <h3>四种方法怎么选？原文的结论</h3>
          <blockquote>
            <p>
              当采样周期 <i>T</i> 比较小时，这几种离散化方法的效果相差不多。当采样周期 <i>T</i> 逐渐变大时，效果会相应变差。
              在这些离散化方法中，相对而言，<b>双线性变换法的效果比较好，应用也比较广泛</b>。
            </p>
            <p>
              应当指出，由于采样必然带来信息损失，所以<b>不论采用哪一种离散化方法，得出数字校正装置的特性
              都不可能与原连续校正装置的特性完全一样</b>。
            </p>
            <p className="source">——《自动控制原理（卢京潮）》6.8.1 节</p>
          </blockquote>
          <Callout type="ok">
            <p>
              这四种方法的手感差别，用 <Link to="/tools/tustin">Tustin 计算器</Link> 改 Ts、开关预畸变，
              几秒钟就能看出来——尤其看 <b>fs/2 附近的相位掉得多快</b>。
            </p>
          </Callout>

          {/* §5 ─────────────────────────────────────────────────────────── */}
          <h2 id="s5"><span className="sec">§5</span>延伸要付的五笔账</h2>

          <h3>5.1 混叠与采样定理</h3>
          <p>采样信号的频谱是原频谱以 <M latex="\omega_s" /> 为周期搬移叠加：</p>
          <MathBlock latex="E^*(j\omega)=\frac{1}{T}\sum_{n=-\infty}^{\infty}E\big[j(\omega+n\omega_s)\big]" />
          <p>要不混叠，必须让主频谱与高频谱分开，即香农条件：</p>
          <MathBlock latex="\omega_s\ge 2\omega_h\qquad\text{或}\qquad T\le\frac{\pi}{\omega_h}" />
          <p>否则原文说得很干脆：<b>「即使使用理想滤波器，也无法将主频谱分离出来」</b>。</p>
          <p>工程上还要在采样器前加抗混叠预滤波器（Franklin 8.5.3 节），目标是在 <M latex="\omega_s/2" /> 处提供足够衰减。</p>

          <h3>5.2 采样率到底选多高</h3>
          <div className="overflow-x-auto">
            <table className="data-table small">
              <thead><tr><th>判据</th><th>数值</th><th>出处</th></tr></thead>
              <tbody>
                <tr><td>与连续补偿器性能匹配</td><td><M latex="\ge 20\times" /> 带宽</td><td>Franklin 8.1 节</td></tr>
                <tr><td>数字控制器最佳性能</td><td><M latex="\gt 25\times" /> 带宽</td><td>Franklin 8.1 节</td></tr>
                <tr><td>工程经验（随动系统）</td><td><M latex="\omega_s\approx 10\omega_c" />，<M latex="T=\frac{\pi}{5}\cdot\frac{1}{\omega_c}" /></td><td>卢京潮 6.2.3 节</td></tr>
                <tr><td>按调节时间</td><td><M latex="T=\frac{1}{40}t_s" /></td><td>卢京潮 6.2.3 节</td></tr>
              </tbody>
            </table>
          </div>

          <h3>5.3 零阶保持带来的 T/2 延迟</h3>
          <blockquote>
            <p>
              这些阶梯信号都是从 <M latex="u(kT)" /> 开始，<b>平均延迟了 T/2</b>。若将这 T/2 的延迟简单地纳入到系统的连续分析中，
              就能很好地预测当采样速率远低于 20 倍带宽时采样对系统的影响。
            </p>
            <p className="source">——Franklin 8.1 节</p>
          </blockquote>

          <h3>5.4 双线性的频率畸变 → 预畸变</h3>
          <p>双线性在 <M latex="f_s/2" /> 附近幅相都会偏离，Erickson 给的标准修正是<b>频率预畸变</b>：</p>
          <MathBlock latex="s\to k_{\text{prewarp}}\cdot\frac{2}{T_s}\frac{z-1}{z+1},\qquad k_{\text{prewarp}}=\frac{\omega_{\text{prewarp}}T_s/2}{\tan(\omega_{\text{prewarp}}T_s/2)}" />
          <p>
            它使 <M latex="G_c" /> 与 <M latex="G_{cd}" /> 在指定频率 <M latex="\omega_{\text{prewarp}}" /> 处
            <b>幅值与相位精确重合</b>，代价是低频段失配略增。
          </p>
          <Callout type="warn" label="检索陷阱">
            <p>
              中文词「预畸变」在本知识库 <b>0 命中</b>。这个概念只以英文{' '}
              <b>prewarp / frequency prewarping</b> 形式存在。只搜中文会漏。
            </p>
          </Callout>

          <h3>5.5 离散化可能破坏可控性</h3>
          <p>这一条容易被忽略。卢京潮 8.4.5 节：</p>
          <blockquote>
            <p>一个可控的连续系统，在其离散化后并不一定能保持其可控性；一个可观测的连续系统，离散化后也并不一定能保持其可观测性。</p>
          </blockquote>
          <p>
            例：<M latex="\ddot{x}+\omega^2x=u" /> 离散化后，当{' '}
            <M latex="T=k\pi/\omega\ (k=1,2,\cdots)" /> 时，可控性矩阵为零矩阵，<b>系统不可控</b>。
            所以采样周期不是越小越安全，它是有结构的。
          </p>

          {/* §6 ─────────────────────────────────────────────────────────── */}
          <h2 id="s6"><span className="sec">§6</span>落地到开关变换器</h2>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>环节</th><th>要点</th><th>出处</th></tr></thead>
              <tbody>
                <tr><td>PWM 本身是采样+保持</td><td><M latex="D(z)=U_c(z)/V_M" /></td><td>张卫平 4.1 节</td></tr>
                <tr><td>开关调节系统是离散系统</td><td>PWM 是「模数变换器」</td><td>张卫平 3.1.1 节</td></tr>
                <tr><td>数字环路增益</td><td>多一项延时 <M latex="e^{-st_d}" /></td><td>Erickson (19.55)</td></tr>
                <tr><td>离散 PID 实现</td><td>后向欧拉 / Tustin 两种都常见</td><td>Digital Control of HF SMPS §2.3</td></tr>
                <tr><td>数字补偿调参</td><td>「Q 值匹配」，用 <M latex="X_{\text{factor}}" /> 修正 <M latex="k_p" /></td><td>Maniktala《环路设计指南》</td></tr>
              </tbody>
            </table>
          </div>
          <p>Erickson 的环路增益式值得单独看，因为它把离散化的全部代价一次写清：</p>
          <MathBlock latex="T_d(j\omega)=\Big[H(s)G_{vd}(s)\,\mathrm{e}^{-st_d}\Big]_{s\to j\omega}\cdot G^{*}_{cd}(z)\Big|_{z\to e^{j\omega T_s}}" />
          <p>
            原文特别注明：<b>环路增益不含零阶保持器</b>。与模拟环路的差别只有两项——
            延时 <M latex="e^{-st_d}" />，以及补偿器的采样数据离散性质。
          </p>

          {/* §7 ─────────────────────────────────────────────────────────── */}
          <h2 id="s7"><span className="sec">§7</span>覆盖度说明（诚实版本）</h2>
          <p>本页每一条结论都来自知识库内文档的实际检索，不是凭记忆写的。覆盖情况如下：</p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>主题</th><th>覆盖</th><th>依据</th></tr></thead>
              <tbody>
                <tr><td>s→z 基本关系与几何映射</td><td><span className="tag v">充分</span></td><td>卢京潮 / 双语教材 / Franklin 三本互证</td></tr>
                <tr><td>四种离散化方法</td><td><span className="tag v">充分</span></td><td>卢京潮 6.8 节，公式级完整</td></tr>
                <tr><td>双线性 + 预畸变</td><td><span className="tag v">充分</span></td><td>Erickson 式(19.35)–(19.54)</td></tr>
                <tr><td>张卫平《建模与控制》的离散部分</td><td><span className="tag s">薄弱</span></td><td>全书 z 变换仅 2 块，主线是连续域平均建模</td></tr>
                <tr><td>中文「预畸变」</td><td><span className="tag x">缺失</span></td><td>0 命中，仅有英文 prewarping</td></tr>
                <tr><td>中文「计算延时 / 采样延时」</td><td><span className="tag x">缺失</span></td><td>各 0 命中，概念散在英文表述里</td></tr>
              </tbody>
            </table>
          </div>
          <Callout type="note" label="来源等级">
            <p>
              全部结论为<b>原文级</b>（检索命中段落含公式，非摘要推断）。
              但<b>页码级交叉核对未完成</b>：文本块本身不含页码字段，页码来自公式对象的 page 字段，
              这部分属<span className="tag s">样本观察</span>。
            </p>
          </Callout>

          <p className="mt-8"><Link to="/tools/tustin">→ 下一步：用计算器亲手试一遍</Link></p>
        </article>
      </div>
    </div>
  )
}
