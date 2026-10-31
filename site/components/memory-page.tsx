'use client';
import {useEffect,useRef,useState} from 'react';
import type {Action,MemoryFact} from '@/lib/game';
import {MemoryList} from '@/components/memory-list';

// Use the document's normal scroll flow: opening memories must not lock the
// background or depend on a fixed dialog fitting the browser's visual viewport.
export function MemoryPage({facts,act,busy,onBack}:{facts:MemoryFact[];act:(a:Action)=>Promise<boolean>;busy:boolean;onBack:()=>void}){
 const [confirming,setConfirming]=useState(false);
 const [clearError,setClearError]=useState(false);
 const cancelRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(confirming)cancelRef.current?.focus();},[confirming]);
 async function clearAll(){
  setClearError(false);
  if(await act({type:'delete-memory-fact'}))setConfirming(false);
  else setClearError(true);
 }
 return <section className="memory-page panel" aria-label="长期记忆管理">
  <button type="button" className="secondary" onClick={onBack}>返回我的</button>
  <p className="memory-page__description">这些是对话里被记下来的长期记忆，保存在你自己的存档里，随时可以删。</p>
  {confirming?<section className="memory-clear-confirm" aria-labelledby="memory-clear-title">
   <h2 id="memory-clear-title">清空全部长期记忆？</h2>
   <p>这 {facts.length} 条被它记住的事会全部删除，无法恢复。你的对话与行动记录不受影响。</p>
   {clearError&&<p className="error" role="alert">清空结果尚未确认。请按页面提示重新读取存档后再决定是否重试。</p>}
   <div className="memory-clear-confirm__actions">
    <button type="button" ref={cancelRef} className="secondary" disabled={busy} onClick={()=>{setConfirming(false);setClearError(false);}}>保留记录</button>
    <button type="button" className="secondary" disabled={busy||!facts.length} onClick={clearAll}>{busy?'正在清空…':'确认清空'}</button>
   </div>
  </section>:<MemoryList facts={facts} act={act} busy={busy} onClearAll={()=>setConfirming(true)}/>}
 </section>;
}
