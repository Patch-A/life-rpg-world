'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Box,Download,Expand,Pause,Play,RotateCcw,Sparkles} from 'lucide-react';
import type {TimerViewer} from './focus-timer-viewer';
import './art-lab.css';

type ViewerState='idle'|'loading'|'ready'|'error';

export function ArtLab(){
  const canvas=useRef<HTMLCanvasElement>(null),controller=useRef<TimerViewer|null>(null);
  const [state,setState]=useState<ViewerState>('idle'),[loadAttempt,setLoadAttempt]=useState(0);
  const [view,setView]=useState('free');
  const [progress,setProgress]=useState(0),[running,setRunning]=useState(false);
  const elapsed=useRef(0),started=useRef(0);
  const current=useRef({progress,running});current.current={progress,running};
  useEffect(()=>{
    if(!loadAttempt)return;
    const abort=new AbortController();let observer:IntersectionObserver|undefined;let viewer:TimerViewer|undefined;
    setState('loading');
    const timeout=window.setTimeout(()=>{if(!viewer){setState('error');abort.abort();}},30000);
    void import('./focus-timer-viewer').then(async({createTimerViewer})=>{
      if(abort.signal.aborted||!canvas.current)return;
      viewer=await createTimerViewer(canvas.current,abort.signal,()=>{setState('error');setRunning(false);controller.current?.dispose();controller.current=null;});
      if(abort.signal.aborted){viewer.dispose();return;}
      window.clearTimeout(timeout);controller.current=viewer;viewer.progress(current.current.progress,current.current.running);setState('ready');
      observer=new IntersectionObserver(entries=>viewer?.visible(entries[0].isIntersecting),{threshold:.02});observer.observe(canvas.current);
    }).catch(()=>{window.clearTimeout(timeout);if(!abort.signal.aborted)setState('error');});
    return()=>{window.clearTimeout(timeout);abort.abort();observer?.disconnect();viewer?.dispose();controller.current=null;};
  },[loadAttempt]);
  useEffect(()=>{controller.current?.progress(progress,running);},[progress,running]);
  useEffect(()=>{
    if(!running)return;
    const tick=()=>{
      const value=Math.min(1,(elapsed.current+performance.now()-started.current)/10000);setProgress(value);
      if(value>=1){elapsed.current=10000;setRunning(false);}
    };
    const visibleTick=()=>{if(!document.hidden)tick();};
    const id=window.setInterval(visibleTick,100);document.addEventListener('visibilitychange',visibleTick);tick();
    return()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',visibleTick);};
  },[running]);
  const toggle=()=>{
    if(running){elapsed.current+=performance.now()-started.current;setRunning(false);}
    else{if(progress>=1){elapsed.current=0;setProgress(0);}started.current=performance.now();setRunning(true);}
  };
  const reset=()=>{elapsed.current=0;setProgress(0);setRunning(false);controller.current?.view('free');setView('free');};
  return <main className="art-lab">
    <nav className="al-nav"><a href="/"><ArrowLeft size={17}/>返回成长星球</a><span>ART STUDIO <i/> 01</span></nav>
    <header className="al-header"><div><p className="al-kicker">成长星球 · 美术工坊</p><h1>让每一件道具，<br/>都有值得靠近的细节。</h1><p className="al-intro">先看清形状，再感受交互。这里展示新一版资产的制作进度。</p></div><div className="al-note"><Sparkles size={21}/><strong>本轮样品</strong><span>专注计时器 · 可旋转 3D</span><span>探索者 · 建模参考</span></div></header>
    <a href="/character-lab" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,padding:'18px 22px',marginBottom:24,border:'1px solid #ad91d94d',borderRadius:16,background:'#30243c',color:'#e8d8fc'}}><span><strong style={{display:'block'}}>新的角色体验室</strong><small>男女立绘 · 探索装与礼服 · 任务庆祝 · 生日开箱</small></span><ArrowUpRight size={22}/></a>
    <section className="al-prop" aria-labelledby="prop-title">
      <div className="al-stage">
        <div className="al-stage-top"><span><Box size={15}/>道具样品 01</span><span>星光罗盘</span></div>
        <canvas key={loadAttempt} ref={canvas} className="al-canvas" aria-label="专注计时器三维模型；使用下方按钮切换视角，也可拖动旋转、滚轮或双指缩放" style={{visibility:state==='ready'?'visible':'hidden'}}/>
        {state!=='ready'&&<div className="al-load"><div className="al-load-icon"><Box size={40}/></div><h3>{state==='loading'?'正在载入三维样品':state==='error'?'暂时无法显示 3D':'把星光罗盘拿近一点'}</h3><p>{state==='error'?'可重试，或下载模型查看。':'点击后加载模型，查看正面、侧面与背面的细节。'}</p><button disabled={state==='loading'} onClick={()=>setLoadAttempt(n=>n+1)}>{state==='loading'?'加载中…':state==='error'?'重试加载':'查看 3D 样品'}<ArrowUpRight size={16}/></button></div>}
        <div className="al-viewbar" aria-label="模型视角">{([['free','立体'],['front','正面'],['side','侧面'],['back','背面']] as const).map(([key,label])=><button key={key} aria-pressed={view===key} disabled={state!=='ready'} onClick={()=>{controller.current?.view(key);setView(key);}}>{label}</button>)}<span><Expand size={13}/>拖动旋转 · 双指缩放</span></div>
      </div>
      <div className="al-prop-info"><span className="al-pill">已制作 · 3D 道具</span><h2 id="prop-title">专注计时器</h2><p>象牙金的外圈、青色珐琅表盘与淡紫光环，把一次专注变成一段小小的旅程。</p><dl><div><dt>形状</dt><dd>立体星芒 · 侧面旋钮 · 背面刻纹</dd></div><div><dt>交互</dt><dd>按下启动 · 指针前进 · 光环点亮</dd></div></dl><div className="al-demo"><div><span>10 秒交互演示</span><strong>{Math.max(0,10-Math.floor(progress*10)).toString().padStart(2,'0')}<small>秒</small></strong></div><div className="al-progress" role="progressbar" aria-label="演示进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><i style={{width:`${progress*100}%`}}/></div><div className="al-demo-actions"><button className="al-primary" disabled={state!=='ready'} onClick={toggle}>{running?<Pause size={16}/>:<Play size={16}/>} {running?'暂停演示':progress>=1?'再次演示':'开始演示'}</button><button disabled={state!=='ready'} onClick={reset} aria-label="重置演示与视角"><RotateCcw size={16}/></button></div><p aria-live="polite">{progress>=1?'演示完成，可以重新播放。':'样品演示不计入成长记录。'}</p></div><a className="al-download" href="/art-lab/focus-timer-v1.glb" download><Download size={16}/>下载三维模型（GLB）</a></div>
    </section>
    <section className="al-reference"><div className="al-section-head"><div><span className="al-kicker">角色制作进度</span><h2>探索者，从已确认的脸型开始。</h2></div><span className="al-pill al-pending">参考稿已整理 · 人物模型待制作</span></div><p>男角色的正、侧、背参考已补齐。面部沿用已确认稿；后续建模需要核对各视图的服装细节，并完成网格、贴图、骨骼和动作。</p><a className="al-sheet" href="/art-lab/explorer-modeling-reference.jpg" target="_blank" rel="noreferrer"><img src="/art-lab/explorer-modeling-reference.jpg" alt="男角色探索装建模参考：正面、侧面、背面，附面部、背包和材质细节；这是概念参考图，并非可旋转模型" loading="lazy" width="1536" height="1024"/><span>打开大图<Expand size={15}/></span></a><div className="al-reference-links"><a href="/art-lab/approved-faces.jpg" target="_blank" rel="noreferrer">查看已确认的男女脸型<ArrowUpRight size={15}/></a><a href="/art-lab/asset-production-brief.md" download>下载资产制作与验收要求<Download size={15}/></a></div></section>
    <footer className="al-footer"><span>成长星球 · 美术工坊</span><p>先验收单件，再扩展整套角色、服装与道具。</p></footer>
  </main>;
}
