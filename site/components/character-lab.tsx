'use client';

import {useEffect, useReducer, useRef, useState} from 'react';
import type {CSSProperties, PointerEvent} from 'react';
import {ArrowLeft, ArrowUpRight, Check, CheckCheck, ChevronRight, Compass, Expand, Gift, Heart, LockKeyhole, MessageCircle, MoonStar, RotateCcw, Shirt, Sparkles, Star, WandSparkles, X} from 'lucide-react';
import {createLabState, labExperience, labReducer} from '../lib/character-lab-state';
import type {LabAvatar, LabOutfit} from '../lib/character-lab-state';
import './character-lab.css';

const people: Record<LabAvatar, {name: string; label: string; outfit: string}> = {
  male: {name: '星野', label: '男角色', outfit: '星光西装'},
  female: {name: '星遥', label: '女角色', outfit: '星光礼裙'},
};
const greetings = ['今天的小小进步，也值得被看见。', '不用赶路，我们一步一步来。', '准备好了吗？去完成今天的一件小事。'];
const source = (avatar: LabAvatar, outfit: LabOutfit) => `/character-lab/${avatar}-${outfit}.webp`;

function CharacterSprite({avatar, outfit, onTouch}: {avatar: LabAvatar; outfit: LabOutfit; onTouch: () => void}) {
  const [status, setStatus] = useState<'loading'|'ready'|'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const timeout = window.setTimeout(() => setStatus(s => s === 'loading' ? 'error' : s), 15000);
    return () => window.clearTimeout(timeout);
  }, [attempt]);
  return <div className={`cl-sprite-frame cl-sprite-${status}`}>
    <button className="cl-character" onClick={onTouch} disabled={status !== 'ready'} aria-label={`与${people[avatar].name}打招呼`}>
      <img src={`${source(avatar, outfit)}${attempt ? `?retry=${attempt}` : ''}`} width="768" height="1152" alt={`${people[avatar].label}${people[avatar].name}，身穿${outfit === 'explorer' ? '象牙白探索装与淡紫围巾' : people[avatar].outfit}`} fetchPriority="high" decoding="async" onLoad={() => setStatus('ready')} onError={() => setStatus('error')}/>
    </button>
    {status !== 'ready' && <div className="cl-image-status" role="status"><Sparkles size={25}/><span>{status === 'loading' ? '探索者正在准备…' : '立绘暂时未能载入'}</span>{status === 'error' && <button onClick={() => {setStatus('loading'); setAttempt(n => n + 1);}}>重新加载</button>}</div>}
  </div>;
}

export function CharacterLab() {
  const [state, dispatch] = useReducer(labReducer, undefined, createLabState);
  const [zoom, setZoom] = useState(false);
  const [motion, setMotion] = useState(true);
  const [systemReduced, setSystemReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [speech, setSpeech] = useState('');
  const [toast, setToast] = useState('');
  const [burst, setBurst] = useState(0);
  const [giftFor, setGiftFor] = useState<LabAvatar | null>(null);
  const [pulse, setPulse] = useState(0);
  const [tilt, setTilt] = useState({x: 0, y: 0});
  const dialog = useRef<HTMLDialogElement>(null);
  const scene = useRef<HTMLElement>(null);
  const greetingIndex = useRef(0);
  const drag = useRef<{x: number; y: number; moved: boolean} | null>(null);
  const clickBlocked = useRef(false);
  const actor = people[state.avatar];
  const outfit = state.outfits[state.avatar];
  const allowMotion = motion && !systemReduced && !hidden;
  const xp = labExperience(state);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    update(); visibility(); media.addEventListener('change', update); document.addEventListener('visibilitychange', visibility);
    return () => {media.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility);};
  }, []);
  useEffect(() => {if (!speech) return; const id = window.setTimeout(() => setSpeech(''), 4400); return () => window.clearTimeout(id);}, [speech, pulse]);
  useEffect(() => {if (!toast) return; const id = window.setTimeout(() => setToast(''), 4000); return () => window.clearTimeout(id);}, [toast]);
  useEffect(() => {if (!burst) return; const id = window.setTimeout(() => setBurst(0), 2200); return () => window.clearTimeout(id);}, [burst]);
  useEffect(() => {const el = dialog.current; if (!el) return; if (giftFor && !el.open) el.showModal(); else if (!giftFor && el.open) el.close();}, [giftFor]);
  useEffect(() => {if (!allowMotion) setTilt({x: 0, y: 0});}, [allowMotion]);

  function hello() {
    if (clickBlocked.current) {clickBlocked.current = false; return;}
    setSpeech(greetings[greetingIndex.current++ % greetings.length]); setPulse(n => n + 1);
  }
  function showScene() {
    if (window.matchMedia('(max-width: 760px)').matches) window.requestAnimationFrame(() => scene.current?.scrollIntoView({behavior: allowMotion ? 'smooth' : 'auto', block: 'start'}));
  }
  function selectAvatar(avatar: LabAvatar) {
    if (avatar === state.avatar) return;
    dispatch({type: 'avatar', avatar}); setSpeech(''); setZoom(false); setTilt({x: 0, y: 0}); showScene();
  }
  function wear(next: LabOutfit) {
    if (next === 'formal' && !state.gifts[state.avatar]) {setGiftFor(state.avatar); return;}
    dispatch({type: 'outfit', outfit: next}); setZoom(false); showScene();
    setToast(next === 'explorer' ? '探索装已换好，准备出发。' : `${actor.outfit}已换好，纪念这一刻。`);
  }
  function finishTask() {
    if (state.taskDone) return;
    dispatch({type: 'task'}); setBurst(n => n + 1); setSpeech('这一步，已经让今天不一样。'); setPulse(n => n + 1); setToast('小目标完成 · 演示经验 +20'); showScene();
  }
  function openGift() {
    if (!giftFor || state.gifts[giftFor]) return;
    dispatch({type: 'gift', avatar: giftFor}); setBurst(n => n + 1); setToast(`${people[giftFor].outfit}已加入体验衣柜`);
  }
  function reset() {
    dispatch({type: 'reset'}); setGiftFor(null); setSpeech(''); setBurst(0); setZoom(false); setTilt({x: 0, y: 0}); greetingIndex.current = 0;
    setToast('样板已重置，可以重新体验。');
  }
  function moveScene(e: PointerEvent<HTMLElement>) {
    if (!allowMotion) return;
    if (drag.current && Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) > 7) {drag.current.moved = true; clickBlocked.current = true;}
    if (e.pointerType !== 'mouse' && !drag.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTilt({x: Math.max(-9, Math.min(9, (e.clientX - rect.left - rect.width / 2) / rect.width * 18)), y: Math.max(-5, Math.min(5, (e.clientY - rect.top - rect.height / 2) / rect.height * 10))});
  }
  const sceneStyle = {'--cl-x': `${tilt.x}px`, '--cl-y': `${tilt.y}px`} as CSSProperties;

  return <main className={`cl-shell ${allowMotion ? 'cl-motion' : 'cl-still'}`}>
    <nav className="cl-nav" aria-label="页面导航"><a href="/"><ArrowLeft size={17}/>成长星球</a><span><i/>角色体验室</span><a href="/art-lab">道具工坊<ArrowUpRight size={15}/></a></nav>
    <header className="cl-heading"><div><p className="cl-eyebrow">A LITTLE MORE ALIVE</p><h1>让成长，有一个<span>鲜活的自己。</span></h1><p className="cl-lede">选一个探索者，完成一件小事。也别忘了，给自己一份礼物。</p></div><div className="cl-demo-note"><WandSparkles size={18}/><span>独立交互样板<small>可反复体验，不计入成长记录</small></span></div></header>

    <div className="cl-layout">
      <section ref={scene} className={`cl-scene ${zoom ? 'cl-closeup' : ''}`} aria-label="角色互动场景" style={sceneStyle} onPointerMove={moveScene} onPointerDown={e => {drag.current = {x: e.clientX, y: e.clientY, moved: false}; clickBlocked.current = false;}} onPointerUp={() => {drag.current = null;}} onPointerCancel={() => {drag.current = null; setTilt({x: 0, y: 0});}} onPointerLeave={() => {drag.current = null; setTilt({x: 0, y: 0});}}>
        <div className="cl-sky" aria-hidden="true"/><div className="cl-orbit cl-orbit-one" aria-hidden="true"/><div className="cl-orbit cl-orbit-two" aria-hidden="true"/>
        <img className="cl-world" src="/world.jpg" alt="" width="1024" height="1024" decoding="async" aria-hidden="true"/>
        <div className="cl-starfield" aria-hidden="true">{Array.from({length: 15}, (_, i) => <i key={i} style={{left: `${(i * 47 + 13) % 96}%`, top: `${(i * 31 + 8) % 82}%`, animationDelay: `${i * .23}s`}}/>)}</div>
        <div className="cl-scene-top"><span className="cl-location"><Compass size={14}/>星光营地</span><button className="cl-camera" aria-pressed={zoom} onClick={() => setZoom(z => !z)}><Expand size={15}/>{zoom ? '查看全身' : '靠近看看'}</button></div>
        <div className="cl-nameplate"><span>EXPLORER / {state.avatar === 'male' ? '01' : '02'}</span><h2>{actor.name}</h2><p>{outfit === 'explorer' ? '日常探索装' : actor.outfit}</p></div>
        <div className="cl-pedestal" aria-hidden="true"/>
        <div className="cl-actor-position"><div key={`${state.avatar}-${outfit}`} className="cl-actor-entrance"><CharacterSprite key={`${state.avatar}-${outfit}`} avatar={state.avatar} outfit={outfit} onTouch={hello}/></div></div>
        {speech && <div key={pulse} className="cl-speech" role="status"><MessageCircle size={15}/><span>{speech}</span></div>}
        {!!burst && allowMotion && <div key={burst} className="cl-confetti" aria-hidden="true">{Array.from({length: 22}, (_, i) => <i key={i} style={{'--ci': i, '--cx': `${(i * 41) % 94 + 3}%`, '--cr': `${i * 47}deg`} as CSSProperties}/>)}</div>}
        {state.taskDone && <span className="cl-earned"><Star size={15} fill="currentColor"/>今日的一小步</span>}
        <div className="cl-scene-bottom"><button onClick={hello}><Heart size={16}/>点我打个招呼</button><span>{zoom ? '近景欣赏 · 点击人物互动' : '轻触人物 · 移动场景感受视差'}</span></div>
      </section>

      <aside className="cl-controls" aria-label="角色与交互选项">
        <section className="cl-panel cl-choose"><div className="cl-section-title"><span className="cl-step">01</span><h2>选择你的探索者</h2></div><div className="cl-avatar-options" role="group" aria-label="选择角色">{(['male', 'female'] as const).map(avatar => <button key={avatar} className={state.avatar === avatar ? 'is-selected' : ''} aria-pressed={state.avatar === avatar} onClick={() => selectAvatar(avatar)}><img src={`/character-lab/${avatar}-explorer-portrait.webp`} alt="" width="200" height="220"/><span><strong>{people[avatar].name}</strong><small>{people[avatar].label}</small></span><i>{state.avatar === avatar && <Check size={13}/>}</i></button>)}</div></section>

        <section className="cl-panel cl-wardrobe"><div className="cl-section-title"><span className="cl-step">02</span><h2>把心情穿在身上</h2><Shirt size={18}/></div><div className="cl-outfits" role="group" aria-label="选择服装">{(['explorer', 'formal'] as const).map(item => {const locked = item === 'formal' && !state.gifts[state.avatar]; return <button key={`${state.avatar}-${item}`} className={outfit === item ? 'is-selected' : ''} aria-pressed={outfit === item} onClick={() => wear(item)}><div className="cl-outfit-art"><img src={source(state.avatar, item)} alt="" width="768" height="1152" loading="lazy"/>{locked && <span className="cl-lock"><LockKeyhole size={12}/>生日礼物</span>}{outfit === item && <span className="cl-wearing"><Check size={11}/>已穿戴</span>}</div><strong>{item === 'explorer' ? '日常探索装' : actor.outfit}</strong><small>{item === 'explorer' ? '向每一天出发' : locked ? '打开礼物后试穿' : '献给值得纪念的你'}</small></button>;})}</div></section>

        <section className="cl-panel cl-moments"><div className="cl-section-title"><span className="cl-step">03</span><h2>让每一步，都有回应</h2></div><div className="cl-task-row"><span className={`cl-task-icon ${state.taskDone ? 'is-done' : ''}`}>{state.taskDone ? <CheckCheck size={21}/> : <Star size={21}/>}</span><div><h3>{state.taskDone ? '今天的一小步，完成了' : '完成今天的一个小目标'}</h3><p>{state.taskDone ? '点亮「行动的开始」徽章' : '试试完成任务后的庆祝反馈'}</p></div><button className="cl-task-button" onClick={finishTask} disabled={state.taskDone}>{state.taskDone ? <><Check size={15}/>已完成</> : <>完成<ChevronRight size={15}/></>}</button></div><div className="cl-xp-label"><span>体验成长值</span><strong>{xp}<small> / 100</small></strong></div><div className="cl-xp-track" role="progressbar" aria-label="体验成长值" aria-valuemin={0} aria-valuemax={100} aria-valuenow={xp}><span style={{width: `${xp}%`}}/></div><button className="cl-birthday" onClick={() => setGiftFor(state.avatar)}><span className="cl-gift-icon"><Gift size={24}/></span><span><strong>{state.gifts[state.avatar] ? '再看看你的生日礼物' : '如果今天，是你的生日'}</strong><small>{state.gifts[state.avatar] ? `${actor.outfit}已解锁` : '一份为你准备的星光礼物'}</small></span><ArrowUpRight size={18}/></button></section>
      </aside>
    </div>

    <footer className="cl-footer"><div><span className="cl-dot"/>立绘角色 · 分层场景 · 轻量互动</div><div className="cl-footer-actions"><button aria-pressed={motion && !systemReduced} onClick={() => setMotion(m => !m)} disabled={systemReduced}><MoonStar size={15}/>{systemReduced ? '已跟随系统减少动态' : motion ? '轻动效：开' : '轻动效：关'}</button><button onClick={reset}><RotateCcw size={15}/>重新体验</button></div></footer>
    <p className="cl-footnote">这是一版角色交互样板。人物为二维立绘；完整转身、自然挥手与表情动画不在本版范围内。</p>
    {toast && <div className="cl-toast" role="status"><Check size={16}/>{toast}</div>}

    <dialog ref={dialog} className="cl-gift-dialog" aria-labelledby="cl-gift-title" onCancel={() => setGiftFor(null)} onClose={() => setGiftFor(null)} onClick={e => {if (e.target === e.currentTarget) setGiftFor(null);}}>
      {giftFor && <div className="cl-gift-content"><button className="cl-dialog-close" aria-label="关闭生日礼物" onClick={() => setGiftFor(null)}><X size={20}/></button><span className="cl-eyebrow">A GIFT FOR YOUR JOURNEY</span><h2 id="cl-gift-title">{state.gifts[giftFor] ? '愿你，永远闪闪发光。' : `生日快乐，${people[giftFor].name}。`}</h2><p>{state.gifts[giftFor] ? '属于你的星光礼服，已经放进衣柜。' : '新的一岁，也把温柔和勇气留给自己。'}</p>{state.gifts[giftFor] ? <div className="cl-gift-reveal"><img src={source(giftFor, 'formal')} alt={`${people[giftFor].name}的${people[giftFor].outfit}`} width="768" height="1152"/><span><Sparkles size={15}/>{people[giftFor].outfit} · 已获得</span></div> : <button className="cl-present" aria-label="打开生日礼物" onClick={openGift}><span className="cl-present-bow"/><span className="cl-present-lid"/><span className="cl-present-box"><Star size={30}/></span><span className="cl-present-hint">轻触，拆开你的礼物</span></button>}{state.gifts[giftFor] ? <button className="cl-primary" onClick={() => {dispatch({type: 'avatar', avatar: giftFor}); dispatch({type: 'outfit', outfit: 'formal'}); setZoom(false); setGiftFor(null); showScene(); setToast('礼服已换好，纪念这一刻。');}}>穿上这份星光<ArrowUpRight size={17}/></button> : <button className="cl-primary" onClick={openGift}>打开生日礼物<Gift size={17}/></button>}<small className="cl-gift-disclaimer">生日场景演示 · 不改变真实生日与奖励记录</small></div>}
    </dialog>
  </main>;
}
