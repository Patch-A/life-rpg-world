'use client';

import './treant.css';

/**
 * 记录官的五种形象。前四种是运行状态，`still`（闭眼静止）是「减少动态效果」时的落点。
 */
export type TreantState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'still';

export interface TreantProps {
  state?: TreantState;
  className?: string;
}

/**
 * 记录官：一棵会记事的树人。
 *
 * 素材是 v3 五张独立透明图（`docs/art/recordkeeper-states-v3/`，2026-11-01 交付），
 * 已压成 WebP 放 `public/recordkeeper/`。**五张同画布、同缩放比、土包底边对齐**，
 * 所以这里可以简单地叠起来做交叉淡入——任何一张单独 contain 都会让树跳高矮。
 *
 * 五张全部常驻 DOM、只切 opacity。理由：
 * 换图用 src 会在弱网手机上闪一下空白；而树人在首页是常驻的，闪一次很显眼。
 * 1024×1024 的 WebP 一张 65–79KB，五张合计约 365KB；首屏可以先只加载 idle。
 *
 * `still`（静止）对应旧的「第五态」：它是素材自带的闭眼态，
 * 「减少动态效果」开关打开时直接停在它上面，见 treant.css。
 *
 * 外部只认 `.treant` 这个盒子和 `data-state` 这一个属性——换素材时别改这两样。
 */
export function Treant({state = 'idle', className = ''}: TreantProps) {
  return (
    <div
      className={`treant ${className}`.trim()}
      data-state={state}
      // 外层 section 已经叫「记录官」了，这里再报一遍只会让读屏重复。
      aria-hidden="true"
    >
      <img className="treant__state" data-state-name="idle" src="/recordkeeper/state-idle.webp" alt="" width={1024} height={1024}/>
      <img className="treant__state" data-state-name="speaking" src="/recordkeeper/state-speaking.webp" alt="" width={1024} height={1024} loading="lazy"/>
      <img className="treant__state" data-state-name="listening" src="/recordkeeper/state-listening.webp" alt="" width={1024} height={1024} loading="lazy"/>
      <img className="treant__state" data-state-name="thinking" src="/recordkeeper/state-thinking.webp" alt="" width={1024} height={1024} loading="lazy"/>
      <img className="treant__state" data-state-name="still" src="/recordkeeper/state-still.webp" alt="" width={1024} height={1024} loading="lazy"/>
    </div>
  );
}
