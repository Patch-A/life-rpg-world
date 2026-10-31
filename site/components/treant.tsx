'use client';

import './treant.css';

/** 记录官的四种活动状态。`sleeping` 不在这里——它由「减少动态效果」决定，交给 CSS。 */
export type TreantState = 'idle' | 'speaking' | 'listening' | 'thinking';

export interface TreantProps {
  state?: TreantState;
  className?: string;
}

/**
 * 记录官：一棵会记事的树人。
 *
 * 这是**占位素材**，不是终稿。它存在的意义是把三件容易返工的事先钉死：
 * 构图比例、配色、以及 data-state 这套状态机。等
 * `docs/art/brief-recordkeeper-treant.md` 的概念稿到位，把下面的 <svg> 换成
 * <img src="..."> 就行，外部只认 `.treant` 这一个盒子和 `data-state` 这一个属性。
 *
 * 三条约束照着需求单来，改图时别破坏：
 * 1. 56px 下还要认得出是树 —— 所以没有细枝、没有树皮纹理，全是大色块
 * 2. 身上不许出现紫色（主色 #a98ecf 会和玩家角色撞）
 * 3. 不长人手人脚 —— 枝是枝、根是根，没有衣服没有鞋
 */
export function Treant({state = 'idle', className = ''}: TreantProps) {
  return (
    <svg
      className={`treant ${className}`.trim()}
      data-state={state}
      viewBox="0 0 100 132"
      // 根要落在容器底边，才能站在台座上；等比缩放到装不下时也不能裁掉树冠。
      preserveAspectRatio="xMidYMax meet"
      // 外层 section 已经叫「记录官」了，这里再报一遍只会让读屏重复。
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* 树冠：顶上是日晒的暖黄，往下过渡到薄荷绿。这条渐变就是「青绿到暖黄」的落点。 */}
        <linearGradient id="treant-crown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8c07a"/>
          <stop offset="0.5" stopColor="#a8dfae"/>
          <stop offset="1" stopColor="#7fd6b0"/>
        </linearGradient>
        {/* 树干：中间亮两侧暗，才不是一个色块贴上去的圆柱。 */}
        <linearGradient id="treant-bark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6344"/>
          <stop offset="0.45" stopColor="#c9a077"/>
          <stop offset="1" stopColor="#8a6344"/>
        </linearGradient>
        {/* 说话时从叶缝里透出来的光。用渐变不用 filter:blur——56px 下模糊一点点就糊成一片。 */}
        <radialGradient id="treant-halo">
          <stop offset="0" stopColor="#e8c07a" stopOpacity="0.55"/>
          <stop offset="0.6" stopColor="#a8dfae" stopOpacity="0.18"/>
          <stop offset="1" stopColor="#7fd6b0" stopOpacity="0"/>
        </radialGradient>
      </defs>

      <circle className="treant__glow" cx="50" cy="44" r="46" fill="url(#treant-halo)"/>

      {/* 根：不是脚。
          前两版都失败了——第一版是两根向上蜷的小钩，缩到 56px 变成两只小鞋；
          第二版改成向外铺开的两撇，还是像叉腿站着。问题出在「两条对称的纵线条」这个形状本身，
          怎么调都像腿。所以换成一块低矮的土包：树是从地里长出来的，没有脚。
          土包宽度 20–80，比树冠（10–90）窄一圈，不会喧宾夺主。 */}
      <path className="treant__base" d="M20 131C30 123 41 117 50 117C59 117 70 123 80 131Z" fill="#5f4230"/>

      <path className="treant__trunk" d="M40 56C37 78 36 102 37 121L63 121C64 102 63 78 60 56Z" fill="url(#treant-bark)"/>
      {/* 思考时（`.thinking`）三圈年轮会依次亮一下，见 treant.css。
          试过在树冠外面加一道转圈的弧，56px 下完全看不出来——线太细、还要和光晕底色打架。
          年轮本来就是「它在记东西」，让它自己亮起来比外挂一个 spinner 更贴近这棵树的设定。 */}
      <g className="treant__rings" fill="none" stroke="#e8c07a" strokeWidth="2" strokeLinecap="round" opacity="0.8">
        <path d="M43 72Q50 68 57 72"/>
        <path d="M42 81Q50 77 58 81"/>
        <path d="M41 90Q50 86 59 90"/>
      </g>

      {/* 枝：两截短枝代替手臂，不伸出去抓东西。 */}
      <g className="treant__branches" fill="none" stroke="#8a6344" strokeWidth="6" strokeLinecap="round">
        <path d="M42 66L28 58"/>
        <path d="M58 66L72 58"/>
      </g>

      <g className="treant__canopy">
        {/* 竖起来的那片叶子要**压在树冠上**，不能悬在旁边——
            悬空时它不是「一片叶子」，是一个独立的绿点，56px 下完全读不出「在听」。
            cx 从 78 挪到 71，让它的根部埋进最右那团树冠里。 */}
        <g className="treant__ear"><ellipse cx="71" cy="18" rx="5.5" ry="11" fill="#a8dfae"/></g>
        <ellipse cx="50" cy="26" rx="21" ry="17" fill="url(#treant-crown)"/>
        <ellipse cx="29" cy="40" rx="19" ry="16" fill="url(#treant-crown)"/>
        <ellipse cx="71" cy="40" rx="19" ry="16" fill="url(#treant-crown)"/>
        <ellipse cx="50" cy="40" rx="27" ry="21" fill="url(#treant-crown)"/>
        {/* 叶隙：说话时这一点点亮起来，光从缝里透出。 */}
        <g className="treant__leaves" fill="#dcf7e4" opacity="0.45">
          <circle cx="42" cy="34" r="3"/>
          <circle cx="58" cy="30" r="2.4"/>
          <circle cx="50" cy="45" r="2.6"/>
          <circle cx="34" cy="44" r="2"/>
          <circle cx="67" cy="45" r="2"/>
        </g>
      </g>

      {/* 脸：眼睛和嘴都做得比「可爱」要大一号——56px 下 rx=3 只剩 1.7px，
          再小就完全看不见了。 */}
      <g className="treant__face">
        <ellipse className="treant__eye" cx="44" cy="100" rx="3.2" ry="4" fill="#3b2a1e"/>
        <ellipse className="treant__eye" cx="56" cy="100" rx="3.2" ry="4" fill="#3b2a1e"/>
        <path d="M45.5 108Q50 111.5 54.5 108" fill="none" stroke="#3b2a1e" strokeWidth="2" strokeLinecap="round"/>
      </g>

      {/* 试过在树冠外面加一道转圈的弧来表示「在想」，56px 下看不见：线太细，还和光晕底色打架。
          所以思考时不再加元素，改成让上面那三圈年轮依次亮起来（见 treant.css）。
          「年轮在转」本来就是文档里对 thinking 的描述，让它自己亮比外挂一个转圈更贴这棵树。 */}
    </svg>
  );
}
