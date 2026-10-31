'use client';

import {useState} from 'react';
import {ScrollText} from 'lucide-react';
import {availableXP,day,domains,type Action,type Game,type JournalEntry} from '@/lib/game';
import {departedMonsters,monsterMeta} from '@/lib/monsters';
import './records-page.css';

type Act=(action:Action)=>Promise<boolean>;

// 与 chat-room 同一时刻口径：上海时区、24 小时制；at 异常时不显示时刻而不是显示假时刻。
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function timeOf(at:string){if(typeof at!=='string'||!at)return '';const d=new Date(at);if(Number.isNaN(d.getTime()))return '';return clock.format(d);}
// 日期的「今天/昨天」按存档自己的 day() 口径算，不用设备时区，避免跨时区错一天。
function shiftDay(date:string,n:number){
 const [y,m,d]=date.split('-').map(Number);
 const t=new Date(Date.UTC(y,m-1,d));
 t.setUTCDate(t.getUTCDate()+n);
 return t.toISOString().slice(0,10);
}
function dayLabel(date:string,today:string){
 if(date===today)return '今天';
 if(date===shiftDay(today,-1))return '昨天';
 return date;
}
function domainMeta(id:string|undefined){return domains.find(d=>d.id===id)??null;}
// 走掉的怪兽用年月日、不用「今天」：它是往回看的东西，追着今天的日期反而怪。
const dateFmt=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'numeric',day:'numeric'});
function dateLabel(at:string|undefined){
 if(typeof at!=='string'||!at)return '某天';
 const d=new Date(at);
 return Number.isNaN(d.getTime())?'某天':dateFmt.format(d);
}
const STATUS_LABEL:Record<JournalEntry['status'],string>={pending:'待收下',kept:'只留着',claimed:'已转行动'};

/** 把记录按日期分组，日期从新到旧；组内按时刻从新到旧。 */
function groupByDay(entries:JournalEntry[]){
 const sorted=[...entries].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.at||'').localeCompare(String(a.at||'')));
 const groups:{date:string;items:JournalEntry[]}[]=[];
 for(const e of sorted){
  const last=groups[groups.length-1];
  if(last&&last.date===e.date)last.items.push(e);
  else groups.push({date:e.date,items:[e]});
 }
 return groups;
}

export interface RecordsPageProps{
 state:Game;
 act:Act;
 busy:boolean;
 /** 回到首页开口说一句。 */
 onTalk:()=>void;
}

export function RecordsPage({state,act,busy,onTalk}:RecordsPageProps){
 const today=day();
 // 单条展开：记住哪一条在展开全文；再点一次收起。
 const [openId,setOpenId]=useState<string|null>(null);
 // 收下后同一条会变成「已转行动」，展开态跟着失效，这里不额外处理。
 const entries=state.journal;
 const groups=groupByDay(entries);
 const days=new Set(entries.map(e=>e.date)).size;
 const pending=entries.filter(e=>e.status==='pending').length;
 const claimed=entries.filter(e=>e.status==='claimed').length;
 // 领域分布：没归领域的记录单独一档，不硬塞进某个领域假装有归类。
 const byDomain=domains.map(d=>({id:d.id,name:d.name,color:d.color,count:entries.filter(e=>e.domain===d.id).length}));
 const unFiled=entries.filter(e=>!e.domain).length;
 // 走掉的按「走掉的时间」倒序：最近放下的排最前。
 const departed=[...departedMonsters(state)].sort((a,b)=>String(b.resolvedAt||'').localeCompare(String(a.resolvedAt||'')));

 // 没有记录、也没有走掉的怪兽时才是真空页：只有怪兽走过、没留下日记的人，也该看得见那些碑。
 if(!entries.length&&!departed.length)return <section className="records-page">
  <div className="records-empty">
   <ScrollText size={34} aria-hidden="true"/>
   <h2>这里还是空的</h2>
   <p>回到首页说一句今天的事，它会把值得留下的记在这里；一天一天，连成你的人生。</p>
   <button type="button" className="primary" onClick={onTalk}>去说一句</button>
  </div>
 </section>;

 return <section className="records-page">
  {/* 统计带：四个数字并成一条，不为它们单独开四张卡——
     这一页的主角是下面那些记录，顶部不该先吃掉半屏空白。 */}
  <div className="records-stats" role="list">
   <div className="records-stat" role="listitem"><strong>{entries.length}</strong><span>条记录</span></div>
   <div className="records-stat" role="listitem"><strong>{days}</strong><span>记录天数</span></div>
   <div className="records-stat" role="listitem" data-tone={pending>0?'warn':undefined}><strong>{pending}</strong><span>待收下</span></div>
   <div className="records-stat" role="listitem"><strong>{claimed}</strong><span>已转行动</span></div>
  </div>

  {/* 领域分布：一条堆叠横条 + 一行图例。哪一块生活被记得最多，一眼看得出来。 */}
  <section className="records-domains" aria-labelledby="records-domains-title">
   <h2 id="records-domains-title">记在哪一块生活</h2>
   <div className="records-domains__stack" role="img"
    aria-label={[...byDomain.filter(d=>d.count>0).map(d=>`${d.name} ${d.count} 条`),...(unFiled>0?[`未归类 ${unFiled} 条`]:[])].join('，')}>
    {byDomain.filter(d=>d.count>0).map(d=><span key={d.id} style={{flexGrow:d.count,background:d.color}}/>)}
    {unFiled>0&&<span style={{flexGrow:unFiled,background:'#6b6787'}}/>}
   </div>
   <ul className="records-domains__legend">
    {byDomain.filter(d=>d.count>0).map(d=><li key={d.id}><span className="records-domains__swatch" style={{background:d.color}} aria-hidden="true"/>{d.name} {d.count}</li>)}
    {unFiled>0&&<li><span className="records-domains__swatch records-domains__swatch--plain" aria-hidden="true"/>未归类 {unFiled}</li>}
   </ul>
  </section>

  {state.settings.journalTrimmed&&<p className="records-note" role="status">记录已超过 500 条上限，最早的一部分已被删除，<strong>无法恢复</strong>——导出的文件只包含当前存档，也没有导入功能。</p>}

  {/* 走掉的怪兽。放在记录流之前、统计之后：它属于「这一路留下了什么」，
     不属于某一天的流水账——把它塞进按天分组里，会假装它是一条日记。 */}
  {departed.length>0&&<section className="records-departed" aria-labelledby="records-departed-title">
   <div className="records-day__head">
    <h2 id="records-departed-title">走过的</h2>
    <span className="records-day__count">{departed.length} 只</span>
   </div>
   <ul className="records-departed__list">
    {departed.map(m=>{
     const meta=monsterMeta(m);
     return <li key={m.id} className="records-epitaph" data-kind={meta.id}>
      <div className="records-epitaph__head">
       <span className="records-entry__dot" style={{background:meta.color}} aria-hidden="true"/>
       <strong className="records-epitaph__name">{m.name}</strong>
       <span className="records-epitaph__kind">{meta.label}</span>
      </div>
      {/* 碑文是它出现时你的原话，不是最后一击。走掉的时候人想看的是「它当初是什么」。 */}
      <p className="records-epitaph__text">{m.epitaph||m.sourceText||'它就这么淡下去了。'}</p>
      <span className="records-epitaph__meta">{dateLabel(m.createdAt)} 出现 · {dateLabel(m.resolvedAt)} 走掉 · 挨过 {(m.hits||[]).length} 次</span>
     </li>;
    })}
   </ul>
  </section>}

  {/* 主体：按天往下排。这一天说了什么，全在这儿。 */}
  <div className="records-stream">
   {groups.map(group=><section className="records-day" key={group.date} aria-labelledby={`day-${group.date}`}>
    <div className="records-day__head">
     <h2 id={`day-${group.date}`}>{dayLabel(group.date,today)}</h2>
     {group.date!==today&&group.date!==shiftDay(today,-1)&&<span className="records-day__date">{group.date}</span>}
     <span className="records-day__count">{group.items.length} 条</span>
    </div>
    <ul className="records-day__list">
     {group.items.map(entry=>{
      const meta=domainMeta(entry.domain),time=timeOf(entry.at),expanded=openId===entry.id;
      const canClaim=entry.status==='pending'||entry.status==='kept';
      // 认领会生成一条「今天」的行动记录，经验受今天该领域的上限约束，所以按今天算而不是按记录那天。
      const left=availableXP(state,entry.domain??'mind');
      return <li key={entry.id}>
       <article className="records-entry" data-status={entry.status}>
        <button type="button" className="records-entry__open" aria-expanded={expanded} onClick={()=>setOpenId(expanded?null:entry.id)}>
         <span className="records-entry__head">
          <span className="records-entry__dot" style={{background:meta?.color??'#8a86a8'}} aria-hidden="true"/>
          <span className="records-entry__meta">{meta?.name??'未归类'}{time?` · ${time}`:''}</span>
          <span className="records-entry__status" data-status={entry.status}>{STATUS_LABEL[entry.status]}</span>
         </span>
         <span className="records-entry__summary">{entry.summary}</span>
         {expanded&&entry.text&&entry.text!==entry.summary&&<span className="records-entry__text">{entry.text}</span>}
        </button>
        {canClaim&&<div className="records-entry__actions">
         {/* 收下就变成一条真实行动记录；经验满了也允许收，只是不涨经验，别拦着人整理。 */}
         <button type="button" className="records-entry__claim" disabled={busy}
          onClick={()=>act({type:'claim-record',id:entry.id})}>
          {left>0?`收下 · 记进${meta?.name??'认知'} +${left} EXP`:`收下 · 记进${meta?.name??'认知'}`}
         </button>
        </div>}
       </article>
      </li>;
     })}
    </ul>
   </section>)}
  </div>
 </section>;
}
