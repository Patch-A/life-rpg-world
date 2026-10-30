'use client';

import {Fragment,useEffect,useRef,useState,type FormEvent} from 'react';
import {Download,Send,Trash2,Undo2} from 'lucide-react';
import {toast} from 'sonner';
import {readJSON,requestError} from '@/lib/api-client';
import {type Action,type Game,type JournalEntry,availableXP,day,domains} from '@/lib/game';
import {exportJournal} from '@/lib/export-journal';
import type {ChatResult} from '@/lib/ai/chat-contract';
import './chat-room.css';

type Posture='companion'|'counselor';
type Act=(action:Action)=>Promise<boolean>;

// 与导出保持同一时刻口径：上海时区、24 小时制；at 异常时不显示时刻而不是显示假时刻。
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function timeOf(at:string){if(typeof at!=='string'||!at)return '';const d=new Date(at);return Number.isNaN(d.getTime())?'':clock.format(d);}
// 记录的 domain 缺失时与 claim-record 的兜底一致，按认知展示。
function domainMeta(id:string|undefined){return domains.find(d=>d.id===id)??domains[0];}

function RecordCard({entry,state,busy,sending,act}:{entry:JournalEntry;state:Game;busy:boolean;sending:boolean;act:Act}){
  const meta=domainMeta(entry.domain),locked=busy||sending;
  // 经验受「当日同领域上限 30」约束：如实显示会得到的值，避免点下去发现是 0。
  const left=availableXP(state,meta.id);
  const claimLabel=left>0?`算，记进${meta.name} · +${left} EXP`:`算，记进${meta.name} · 今日已满`;
  const time=timeOf(entry.at);
  return <article className="chat-room__record" data-status={entry.status}>
    <div className="chat-room__record-head">
      <span className="chat-room__dot" style={{background:meta.color}} aria-hidden="true"/>
      <span className="chat-room__record-meta">{meta.name}{time?` · ${time}`:''}</span>
      {entry.status==='claimed'&&<span className="chat-room__badge chat-room__badge--claimed">已转为行动</span>}
      {entry.status==='kept'&&<span className="chat-room__badge">只留着</span>}
    </div>
    <p className="chat-room__record-summary">{entry.summary}</p>
    <div className="chat-room__actions">
      {entry.status==='pending'&&<Fragment>
        <button type="button" className="chat-room__claim" disabled={locked} onClick={()=>act({type:'claim-record',id:entry.id})}>{claimLabel}</button>
        <button type="button" className="chat-room__keep" disabled={locked} onClick={()=>act({type:'keep-record',id:entry.id})}>就记着</button>
      </Fragment>}
      {entry.status==='kept'&&<button type="button" className="chat-room__claim" disabled={locked} onClick={()=>act({type:'claim-record',id:entry.id})}>{claimLabel}</button>}
      {entry.status==='claimed'
        ?<button type="button" className="chat-room__undo" disabled={locked} onClick={()=>act({type:'delete-journal',id:entry.id})}><Undo2 size={14} aria-hidden="true"/>撤销</button>
        :<button type="button" className="chat-room__delete" disabled={locked} aria-label={`删除这条记录：${entry.summary}`} onClick={()=>act({type:'delete-journal',id:entry.id})}><Trash2 size={14} aria-hidden="true"/>删除</button>}
    </div>
  </article>;
}

export interface ChatRoomProps{
  state:Game;
  act:Act;
  /** 页面级保存锁：任何 POST /api/game 进行中都为真。 */
  busy:boolean;
  onPosture:(posture:Posture)=>void;
  /** 只在落库成功后通知，供上层朗读；上层不要在这里换个说法。 */
  onLine:(line:string)=>void;
}

export function ChatRoom({state,act,busy,onPosture,onLine}:ChatRoomProps){
  const [draft,setDraft]=useState('');
  const [sending,setSending]=useState(false);
  const [quickReplies,setQuickReplies]=useState<ChatResult['quickReplies']>([]);
  const [saveWarning,setSaveWarning]=useState(false);
  const flight=useRef(false);
  // 切咨询师的同意只对紧跟的那一次请求有效，发送时立刻清零。
  const consentOnce=useRef(false);
  const inputRef=useRef<HTMLInputElement|null>(null);
  const streamRef=useRef<HTMLDivElement|null>(null);
  const today=day();
  const todayRecords=[...state.journal].filter(e=>e.date===today).sort((a,b)=>a.at.localeCompare(b.at));

  useEffect(()=>{const el=streamRef.current;if(el)el.scrollTop=el.scrollHeight;},[state.chat.length]);

  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const text=draft.trim();
    if(flight.current||busy||!text)return;
    flight.current=true;
    const switchConsent=consentOnce.current;consentOnce.current=false;
    const lastAssistant=[...state.chat].reverse().find(t=>t.role==='assistant');
    const prevPosture:Posture=lastAssistant?.posture==='counselor'?'counselor':'companion';
    setSending(true);setSaveWarning(false);setDraft('');setQuickReplies([]);
    try{
      const response=await fetch('/api/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(60000),body:JSON.stringify({requestId:crypto.randomUUID(),userText:text,prevPosture,switchConsent,consent:true,adult:true})});
      const {run}=await readJSON<{run:{id:string;reply:ChatResult;createdAt:string}}>(response);
      if(!run||typeof run.id!=='string'||typeof run.reply?.reply!=='string')throw new Error('返回的数据不完整，本次对话未保存，请重试。');
      // 先落库、再更新界面：刷新后不会出现「界面上有、存档里没有」。
      // run.id 就是 requestId，chat-turn 用它做 clientId，重复提交天然幂等。
      let saved=false;
      try{
        saved=await act({type:'chat-turn',clientId:run.id,userText:text,reply:run.reply.reply,posture:run.reply.posture,askSwitch:run.reply.askSwitch,records:run.reply.records,memoryCandidates:run.reply.memoryCandidates});
      }catch{saved=false;}
      if(!saved){
        // 对话已经在服务端发生过，不把原文塞回输入框；act 自己已 toast 过，这里只在记录区补一句。
        setSaveWarning(true);
        return;
      }
      setQuickReplies(run.reply.quickReplies);
      onLine(run.reply.reply);
      onPosture(run.reply.posture);
    }catch(err){
      // 请求没成功：原文放回输入框，用户可以直接再发一次。
      setDraft(text);
      toast.error(requestError(err));
    }finally{
      flight.current=false;
      setSending(false);
    }
  }

  function pickQuick(reply:ChatResult['quickReplies'][number]){
    // 同意切咨询师只属于这一次点选；改选别的快捷回复就撤销同意，避免永久带着 true。
    consentOnce.current=reply.kind==='accept-switch';
    setDraft(reply.label.slice(0,1000));
    inputRef.current?.focus();
  }

  return <section className="chat-room" aria-label="记录官对话">
    <div className="chat-room__stream" ref={streamRef} role="log" aria-live="polite">
      {state.chat.length===0
        ? <p className="chat-room__empty">说一句今天的感受吧，我会把值得留下的记下来。</p>
        : <ul className="chat-room__turns">
          {state.chat.map((turn,i)=>{
            const previous=state.chat[i-1];
            const newDay=!previous||previous.date!==turn.date;
            // assistant 轮的 id 是「用户轮 id + '-a'」，记录用 runId（即用户轮 id）关联。
            const noted=turn.role==='assistant'&&previous&&previous.role==='user'?state.journal.filter(j=>j.runId===previous.id):[];
            return <Fragment key={turn.id}>
              {newDay&&<li className="chat-room__day-sep">{turn.date===today?'今天':turn.date}</li>}
              <li className={`chat-room__turn chat-room__turn--${turn.role}`}>
                <span className="chat-room__who">{turn.role==='user'?'我':'它'}</span>
                <div className="chat-room__bubble">{turn.text}</div>
                {noted.length>0&&<div className="chat-room__noted">
                  <span className="chat-room__noted-title">我记下了这些</span>
                  <ul>{noted.map(record=><li key={record.id}>{record.summary}</li>)}</ul>
                </div>}
              </li>
            </Fragment>;
          })}
        </ul>}
    </div>

    {quickReplies.length>0&&!sending&&<div className="chat-room__quick" role="group" aria-label="快捷回复">
      {quickReplies.map((reply,i)=><button type="button" key={`${reply.kind}-${i}`} className="chat-room__quick-reply" onClick={()=>pickQuick(reply)}>{reply.label}</button>)}
    </div>}

    <form className="chat-room__compose" onSubmit={send}>
      <input
        ref={inputRef}
        className="chat-room__input"
        value={draft}
        onChange={e=>{consentOnce.current=false;setDraft(e.target.value);}}
        maxLength={1000}
        disabled={sending}
        placeholder={sending?'正在想…':'今天想聊点什么？'}
        aria-label="对记录官说一句话"
        enterKeyHint="send"
        autoComplete="off"
      />
      <button type="submit" className="chat-room__send" disabled={sending||busy||!draft.trim()}>
        {sending?'正在想…':<><Send size={16} aria-hidden="true"/>发送</>}
      </button>
    </form>

    <section className="chat-room__records" aria-labelledby="chat-room-records-title">
      <div className="chat-room__records-head">
        <h3 id="chat-room-records-title">今天的记录</h3>
        <button type="button" className="chat-room__export" onClick={()=>exportJournal(state,today)}><Download size={15} aria-hidden="true"/>导出今天的记录</button>
      </div>
      {saveWarning&&<p className="chat-room__warning" role="alert">这次的记录没存上，重新加载后再试。</p>}
      {todayRecords.length===0
        ? <p className="chat-room__empty">今天还没有记录。</p>
        : <ul className="chat-room__record-list">
          {todayRecords.map(entry=><li key={entry.id}><RecordCard entry={entry} state={state} busy={busy} sending={sending} act={act}/></li>)}
        </ul>}
    </section>
  </section>;
}
