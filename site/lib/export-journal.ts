import {domains,completedActions,type Game} from './game';

// 导出里的时刻统一按上海时区、24 小时制显示。用 h23 避免出现 24:00。
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function timeOf(at:string){if(!at)return '';const d=new Date(at);return Number.isNaN(d.getTime())?'':clock.format(d);}
// 摘要是单行文本，把换行和多余空白压平，避免破坏 Markdown 结构。
const flat=(text:unknown)=>String(text??'').replace(/\s+/g,' ').trim();
function heading(date:string){const [,month,day]=date.split('-');return month&&day?`${Number(month)}月${Number(day)}日`:date;}
export function journalMarkdown(state:Game,date:string){
 const records=[...state.journal].filter(e=>e.date===date).sort((a,b)=>a.at.localeCompare(b.at));
 const recordLines=records.length
  ?records.map(e=>'- '+[timeOf(e.at),domains.find(d=>d.id===e.domain)?.name||'状态',flat(e.summary)].filter(Boolean).join(' · ')).join('\n')
  :'今天还没有记录';
 // 对话摘录只取当天最后 8 条，保持时间正序，不把一问一答拆开太多。
 const excerpt=[...state.chat].filter(t=>t.date===date).slice(-8).map(t=>`> ${t.role==='user'?'我':'它'}：${flat(t.text)}`).join('\n');
 const completed=completedActions(state,{date});
 const todayXp=state.logs.filter(l=>!l.undone&&l.date===date).reduce((n,l)=>n+l.xp,0);
 const parts=[`---\ndate: ${date}\nsource: life-rpg-recordkeeper\n---`,`# ${heading(date)}`,`## 记录\n\n${recordLines}`];
 if(excerpt)parts.push(`## 对话摘录\n\n${excerpt}`);
 parts.push(`## 今日\n\n完成 ${completed} 项 · 经验 +${todayXp}`);
 return parts.join('\n\n')+'\n';
}
export function exportJournal(state:Game,date:string){
 const url=URL.createObjectURL(new Blob([journalMarkdown(state,date)],{type:'text/markdown;charset=utf-8'}));
 const link=document.createElement('a');
 link.href=url;link.download=`${date}-记录官.md`;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
