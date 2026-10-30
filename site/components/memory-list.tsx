'use client';
import type {Action,MemoryFact} from '@/lib/game';
import './memory-list.css';

// 三种记忆类型的中文标签，与 lib/ai/chat-contract 里的 kind 枚举一一对应。
const kindLabels:Record<string,string>={fact:'事实',preference:'偏好',situation:'近况'};
// 权重高的在前；同权重按最近一次被记住的时间倒序。
const byWeight=(a:MemoryFact,b:MemoryFact)=>b.weight-a.weight||b.lastSeen.localeCompare(a.lastSeen);
const seenOn=(m:MemoryFact)=>String(m.lastSeen||'').slice(0,10);

export function MemoryList({facts,act,busy,onClearAll}:{facts:MemoryFact[];act:(a:Action)=>Promise<boolean>;busy:boolean;onClearAll:()=>void}){
 const ordered=[...facts].sort(byWeight);
 if(!ordered.length)return <p className="small-empty">它还没有记住什么。聊聊看，值得留下的会说给你听。</p>;
 return <div className="form-stack">
  <div className="memory-facts">{ordered.map(m=><article className="memory-fact" key={m.id}>
   <div className="memory-fact__head"><span className="source-tag">{kindLabels[m.kind]||'事实'}</span><span className="record-date">{seenOn(m)}</span></div>
   <p>{m.text}</p>
   <div className="memory-fact__foot"><span className="note">被记住 {m.weight} 次</span><button className="text-button" disabled={busy} onClick={()=>act({type:'delete-memory-fact',id:m.id})} aria-label={`删除这条记忆：${m.text}`}>删除这一条</button></div>
  </article>)}</div>
  {/* 清空会一次删掉全部记忆：确认交给页面级 AlertDialog，与其它删除入口一致。 */}
  <button className="secondary full" disabled={busy} onClick={()=>onClearAll()}>全部清空</button>
 </div>;
}
