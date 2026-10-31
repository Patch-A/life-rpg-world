'use client';

import {useState,type ReactNode} from 'react';
import {type Action,type Monster,type MonsterKind} from '@/lib/game';
import {MONSTER_HIT_LABEL,MONSTER_WEIGHT_HP,fadedRatio,monsterKind,monsterMeta,recentHits} from '@/lib/monsters';
import './monster-shade.css';

type Act=(action:Action)=>Promise<boolean>;

// 三种影子各自长什么样。
//
// 第一版画的是「雾 / 裂痕 / 环」，纯氛围、没有本体。放到真图上全垮了：星球图本身又亮又碎，
// 一团半透明暗色看起来就是图上的一块脏印子，不像有个东西在那儿。
//
// 现在所有怪共用同一个身体：暗色的一团，底下有脚，上面有两只会眨的眼睛。
// 先认出「这是个活物」，再靠**颜色和它背上的东西**分种类——
// 身体形状如果也各不相同，三个放在一起就成了三套美术，而不是同一个星球上的三种影子。
//
// 只用纯色 + CSS 透明度，不用渐变和 filter 的 id —— 同一种怪可能同时来两只，
// 重复的 svg id 会让第二只套用第一只的定义。
const BODY='M50 20c14 0 26 11 26 25 0 7-3 13-8 17 3 5 2 11-2 14-5 3-11 1-16-1-5 2-11 4-16 1-4-3-5-9-2-14-5-4-8-10-8-17 0-14 12-25 26-25z';
const EYES=<>
 <ellipse className="monster-shade__eye" cx="43" cy="47" rx="3.2" ry="4.2" fill="var(--monster-eye)"/>
 <ellipse className="monster-shade__eye" cx="57" cy="47" rx="3.2" ry="4.2" fill="var(--monster-eye)"/>
</>;
const SHAPES: Record<MonsterKind,ReactNode>={
 life:<>
  <ellipse className="monster-shade__ground" cx="50" cy="76" rx="29" ry="6" fill="#04060d"/>
  <path d={BODY} fill="#101f19"/>
  {/* 垂下来的叶子：从头顶往两边耷下去，盖住肩。 */}
  <g className="monster-shade__hanging" stroke="#8fdcb8" strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity=".75">
   <path d="M40 20c-3 7-7 11-10 14"/>
   <path d="M50 18c0 7 0 11 0 15"/>
   <path d="M60 20c3 7 7 11 10 14"/>
  </g>
  {EYES}
 </>,
 setback:<>
  <ellipse className="monster-shade__ground" cx="50" cy="76" rx="29" ry="6" fill="#04060d"/>
  <path d={BODY} fill="#181430"/>
  {/* 身上的裂缝：从头顶往左下掰开，绕开眼睛。 */}
  <path className="monster-shade__crack" d="M37 21l-4 9 4 7-6 9 3 9" stroke="#a98ecf" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  <path className="monster-shade__crack" d="M33 37l-7 5" stroke="#8d74b8" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeOpacity=".8"/>
  {EYES}
 </>,
 emotion:<>
  {/* 它不落地：脚下一片暗都没有，只有一圈绕着的环。 */}
  <g className="monster-shade__orbit">
   <circle cx="50" cy="46" r="35" stroke="#b39ad8" strokeWidth="1.6" strokeOpacity=".5" fill="none" strokeDasharray="5 9"/>
   <circle cx="50" cy="46" r="27" stroke="#7d64a8" strokeWidth="1.2" strokeOpacity=".4" fill="none" strokeDasharray="2 12"/>
  </g>
  <path d={BODY} fill="#201a34"/>
  {EYES}
 </>,
};

interface MonsterShadeProps{
 monsters:Monster[];
 selected:string|null;
 onSelect:(id:string)=>void;
}

/**
 * 星球上的影子层。
 *
 * 位置按 kind 固定成三块（spec §1.6）：生活的落在生命森林，挫折的裂在创造之城，
 * 说不清的情绪绕着星球外缘不落地。**位置固定**是刻意的——影子不会跑，
 * 用户第二天回来还能在同一块地方找到它。
 *
 * z-index 压在 1，`.planet-node` 是 2：影子可以铺到标签下面，
 * 但点标签永远点到标签，不会被这层截走。
 */
export function MonsterShade({monsters,selected,onSelect}:MonsterShadeProps){
 if(!monsters.length)return null;
 return <div className="monster-layer" aria-label="星球上的影子">
  {MONSTER_SHADE_ORDER.map(kind=>{
   const group=monsters.filter(m=>monsterKind(m)===kind);
   if(!group.length)return null;
   return <div key={kind} className={`monster-shade-group monster-shade-group--${kind}`}>
    {group.map((m,i)=>{
     const fade=fadedRatio(m);
     const meta=monsterMeta(m);
     return <button
      key={m.id}
      type="button"
      className="monster-shade"
      data-kind={kind}
      data-selected={selected===m.id||undefined}
      // 越薄越淡，但最少留三成——薄到看不见就不该还在场上，而那时它已经 resolvedAt 了。
      // 颜色走 CSS 变量，三种怪只差一个色值，眼睛不用再按 kind 各写一份。
      style={{opacity:0.35+0.65*(1-fade),transform:`translate(${i*14}px,${-i*10}px)`,['--monster-eye' as string]:`${meta.color}`}}
      aria-label={`${m.name}，${meta.label}，已经薄了 ${Math.round(fade*100)}%`}
      aria-pressed={selected===m.id}
      onClick={()=>onSelect(m.id)}
     >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">{SHAPES[kind]}</svg>
      <span className="monster-shade__label">{m.name}</span>
     </button>;
    })}
   </div>;
  })}
 </div>;
}

// 渲染顺序固定，不跟着数组顺序变：同一种怪的影子不该因为新建了一只就整块跳位置。
const MONSTER_SHADE_ORDER:MonsterKind[]=['emotion','life','setback'];

const clock=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric'});
function dayOf(at:string){
 const d=new Date(at);
 if(!at||Number.isNaN(d.getTime()))return '';
 return clock.format(d);
}

interface MonsterCardProps{
 monster:Monster;
 act:Act;
 busy:boolean;
 onClose:()=>void;
}

/**
 * 点开影子后的那张卡。
 *
 * 里面**没有攻击按钮**，这是整个设计的重点：怪兽不是被玩家打死的，
 * 是日子过着过着它就薄了。所以这里只有「它是谁」「当初你为什么是这么说的」
 * 「它薄了多少」「最近因为什么薄下去」。
 */
export function MonsterCard({monster,act,busy,onClose}:MonsterCardProps){
 const [draft,setDraft]=useState(monster.name);
 const [renaming,setRenaming]=useState(false);
 const [confirming,setConfirming]=useState(false);
 const meta=monsterMeta(monster);
 const fade=fadedRatio(monster);
 const hits=recentHits(monster,3);
 const created=dayOf(monster.createdAt);

 async function saveName(){
  const name=draft.trim();
  if(!name||name===monster.name){setRenaming(false);setDraft(monster.name);return;}
  if(await act({type:'monster-rename',id:monster.id,name}))setRenaming(false);
 }
 async function release(){
  const ok=await act({type:'monster-release',id:monster.id});
  if(ok)onClose();
 }

 return <section className="monster-card" aria-label={`${monster.name} 的卡片`}>
  <div className="monster-card__head">
   <span className="monster-card__dot" style={{background:meta.color}} aria-hidden="true"/>
   <span className="monster-card__kind">{meta.label} · {meta.where}</span>
   <button type="button" className="monster-card__close" onClick={onClose} aria-label="收起">收起</button>
  </div>

  {renaming
   ? <div className="monster-card__rename">
      <input className="monster-card__name-input" value={draft} maxLength={20} disabled={busy}
       aria-label="这只怪的名字"
       onChange={e=>setDraft(e.target.value)}/>
      <button type="button" className="monster-card__save" disabled={busy||!draft.trim()} onClick={saveName}>改名</button>
      <button type="button" className="monster-card__cancel" disabled={busy} onClick={()=>{setDraft(monster.name);setRenaming(false);}}>取消</button>
     </div>
   : <div className="monster-card__title-row">
      <h3 className="monster-card__name">{monster.name}</h3>
      <button type="button" className="monster-card__rename-open" disabled={busy} onClick={()=>{setDraft(monster.name);setRenaming(true);}}>改名</button>
     </div>}

  {monster.sourceText&&<blockquote className="monster-card__origin">
   <span className="monster-card__origin-tag">{created?`${created} 那天你说`:'它出现那天你说'}</span>
   {monster.sourceText}
  </blockquote>}

  <div className="monster-card__thin">
   <div className="monster-card__thin-row">
    <span>已经薄了 {Math.round(fade*100)}%</span>
    <span className="monster-card__thin-num">{monster.hp} / {monster.maxHp || MONSTER_WEIGHT_HP[1]}</span>
   </div>
   <div className="monster-card__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fade*100)} aria-label="已经薄了多少">
    <span style={{width:`${Math.round(fade*100)}%`,background:meta.color}}/>
   </div>
  </div>

  {hits.length>0
   ? <ul className="monster-card__hits">
      {hits.map(h=><li key={h.ref}>
       <span className="monster-card__hit-kind">{MONSTER_HIT_LABEL[h.kind]}</span>
       <span className="monster-card__hit-note">{h.note}</span>
      </li>)}
     </ul>
   : <p className="monster-card__idle">还没薄过。它不动，也不会自己长回来——等哪一天你说了、做了、缓过来一点，它会跟着薄一点。</p>}

  {confirming
   ? <div className="monster-card__confirm">
      <span>让它现在就走？它出现时的那句话会留下，变成一条纪念。</span>
      <button type="button" className="monster-card__confirm-yes" disabled={busy} onClick={release}>让它走</button>
      <button type="button" className="monster-card__confirm-no" disabled={busy} onClick={()=>setConfirming(false)}>再等等</button>
     </div>
   : <button type="button" className="monster-card__release" disabled={busy} onClick={()=>setConfirming(true)}>不用等它自己薄下去</button>}
 </section>;
}
